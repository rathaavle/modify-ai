import AzureOpenAI from "openai";
import type { ValidationResult, FieldComparison } from "../types";

/** Timeout AI service dalam milidetik (30 detik) */
const AI_TIMEOUT_MS = 30_000;

/**
 * Fallback explanation yang ditampilkan jika AI service gagal atau timeout.
 * Pesan ini tetap informatif meski tanpa AI.
 */
const FALLBACK_EXPLANATION =
  "Penjelasan AI tidak tersedia saat ini. Silakan periksa hasil perbandingan field di atas untuk melihat detail perbedaan yang ditemukan.";

/**
 * System prompt dalam Bahasa Indonesia untuk Azure OpenAI.
 * Menginstruksikan model untuk menghasilkan penjelasan yang jelas,
 * ringkas, dan relevan untuk konteks verifikasi material farmasi.
 */
const SYSTEM_PROMPT = `Kamu adalah asisten verifikasi material farmasi yang berpengalaman.
Tugasmu adalah memberikan penjelasan yang jelas, ringkas, dan mudah dipahami dalam Bahasa Indonesia
tentang hasil verifikasi kesesuaian data antara label kemasan dan dokumen pendukung (misalnya Certificate of Analysis).

Panduan penulisan:
- Gunakan Bahasa Indonesia yang formal namun mudah dipahami
- Maksimal 3 paragraf
- Paragraf pertama: ringkasan status verifikasi secara keseluruhan
- Paragraf kedua (jika ada mismatch): jelaskan setiap perbedaan yang ditemukan secara spesifik
- Paragraf ketiga: jelaskan implikasi risiko dan rekomendasi tindakan yang perlu diambil
- Jika status VALID dan risiko LOW, cukup satu paragraf konfirmasi singkat
- Jangan gunakan bullet point atau markdown — tulis dalam bentuk paragraf biasa
- Jangan ulangi data mentah secara verbatim; fokus pada interpretasi dan implikasi`;

/**
 * Buat ringkasan teks dari ValidationResult untuk dikirim ke AI.
 * Mengubah data terstruktur menjadi deskripsi yang mudah dipahami model.
 */
function buildUserMessage(result: ValidationResult): string {
  const fieldLabels: Record<string, string> = {
    materialName: "Nama Material",
    batchNumber: "Nomor Batch",
    expiryDate: "Tanggal Kedaluwarsa",
  };

  const mismatchTypeLabels: Record<string, string> = {
    value_mismatch: "nilai berbeda secara substansial",
    format_mismatch: "format berbeda (nilai mungkin sama secara semantik)",
    missing_data: "data tidak ditemukan di salah satu sumber",
  };

  const fieldSummaries = result.fields
    .map((f: FieldComparison) => {
      const label = fieldLabels[f.fieldName] ?? f.fieldName;
      if (!f.isMismatch) {
        return `- ${label}: COCOK (label: "${f.labelValue ?? "tidak ada"}", dokumen: "${f.documentValue ?? "tidak ada"}")`;
      }
      const mismatchDesc = f.mismatchType
        ? (mismatchTypeLabels[f.mismatchType] ?? f.mismatchType)
        : "tidak diketahui";
      return `- ${label}: TIDAK COCOK — ${mismatchDesc} (label: "${f.labelValue ?? "tidak ada"}", dokumen: "${f.documentValue ?? "tidak ada"}")`;
    })
    .join("\n");

  return `Hasil verifikasi material farmasi:

Status: ${result.status}
Tingkat Risiko: ${result.riskLevel}

Detail perbandingan field:
${fieldSummaries}

Berikan penjelasan sesuai panduan yang telah diberikan.`;
}

/**
 * Buat Promise yang reject setelah timeout tertentu.
 */
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(
          Object.assign(
            new Error(`AI service timeout setelah ${ms / 1000} detik`),
            { code: "AI_TIMEOUT" },
          ),
        ),
      ms,
    ),
  );
}

/**
 * Generate penjelasan hasil verifikasi menggunakan Azure OpenAI.
 *
 * Jika AI service gagal (timeout, error koneksi, atau error API),
 * fungsi ini mengembalikan FALLBACK_EXPLANATION — tidak pernah melempar error.
 * Hal ini sesuai dengan desain: AI explanation adalah enhancement, bukan blocker.
 *
 * @param result - Hasil validasi lengkap (status, riskLevel, fields)
 * @returns Penjelasan dalam Bahasa Indonesia, atau fallback string jika gagal
 */
export async function generateExplanation(
  result: ValidationResult,
): Promise<string> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    console.warn(
      "[aiService] Environment variables Azure OpenAI tidak lengkap — menggunakan fallback explanation",
    );
    return FALLBACK_EXPLANATION;
  }

  const client = new AzureOpenAI({
    endpoint,
    apiKey,
    deployment,
    apiVersion: "2024-08-01-preview",
  } as import("openai").AzureClientOptions);

  const userMessage = buildUserMessage(result);

  const completionPromise = client.chat.completions.create({
    model: deployment,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  try {
    const response = await Promise.race([
      completionPromise,
      createTimeoutPromise(AI_TIMEOUT_MS),
    ]);

    const explanation = response.choices[0]?.message?.content?.trim();

    if (!explanation) {
      console.warn(
        "[aiService] Azure OpenAI mengembalikan respons kosong — menggunakan fallback explanation",
      );
      return FALLBACK_EXPLANATION;
    }

    return explanation;
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === "AI_TIMEOUT") {
      console.warn(
        "[aiService] Timeout 30 detik — menggunakan fallback explanation",
      );
    } else {
      console.error("[aiService] Error memanggil Azure OpenAI:", error.message);
    }
    return FALLBACK_EXPLANATION;
  }
}
