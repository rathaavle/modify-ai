import {
  DocumentAnalysisClient,
  AzureKeyCredential,
} from "@azure/ai-form-recognizer";
import type { ExtractedData } from "../types";

/** Timeout OCR dalam milidetik (30 detik) */
const OCR_TIMEOUT_MS = 30_000;

/**
 * Regex patterns untuk mengekstraksi field kritis dari raw text OCR.
 *
 * Setiap pattern mencoba berbagai variasi label yang umum ditemukan
 * pada label kemasan farmasi dan dokumen pendukung (CoA, packing list).
 */
export const PATTERNS = {
  /**
   * Batch / Lot number
   * Contoh: "Batch No: BT-2024-001", "LOT: 12345A", "B.No. XYZ-99"
   */
  batchNumber:
    /(?:batch\s*(?:no\.?|number|#)?|lot\s*(?:no\.?|number|#)?|b\.?\s*no\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/\.]{1,30})/i,

  /**
   * Expiry date
   * Contoh: "Exp: 01/2026", "Expiry Date: January 2026", "Best Before: 2026-01-31"
   */
  expiryDate:
    /(?:exp(?:iry)?(?:\s*date)?|expiration(?:\s*date)?|best\s*before|use\s*before|bb\.?)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.][0-9]{2,4}(?:[\/\-\.][0-9]{2,4})?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+[0-9]{4}|[0-9]{4}[\/\-\.][0-9]{1,2}(?:[\/\-\.][0-9]{1,2})?)/i,

  /**
   * Material / Product name
   * Contoh: "Product: Paracetamol 500mg", "Material: Ibuprofen", "Item Name: Amoxicillin 250mg"
   * Ini adalah fallback — nama produk sering muncul di baris pertama tanpa label eksplisit.
   */
  materialName:
    /(?:product(?:\s*name)?|material(?:\s*name)?|item(?:\s*name)?|nama\s*(?:produk|material|bahan)?|drug\s*name|medicine\s*name)\s*[:\-]?\s*(.{3,80})/i,
};

/**
 * Ekstrak field kritis dari raw text OCR menggunakan regex patterns.
 * Semua field selalu terdefinisi (string | null) — tidak pernah undefined.
 *
 * @param rawText - Teks mentah hasil OCR
 * @returns Objek dengan materialName, batchNumber, expiryDate (masing-masing string | null)
 */
export function parseOcrText(rawText: string): Omit<ExtractedData, "rawText"> {
  const batchMatch = rawText.match(PATTERNS.batchNumber);
  const expiryMatch = rawText.match(PATTERNS.expiryDate);
  const materialMatch = rawText.match(PATTERNS.materialName);

  return {
    batchNumber: batchMatch ? batchMatch[1].trim() : null,
    expiryDate: expiryMatch ? expiryMatch[1].trim() : null,
    materialName: materialMatch ? materialMatch[1].trim() : null,
  };
}

/**
 * Buat Promise yang reject setelah timeout tertentu.
 * Digunakan untuk membatasi waktu tunggu OCR.
 */
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(
          Object.assign(
            new Error(`OCR service timeout setelah ${ms / 1000} detik`),
            {
              code: "OCR_TIMEOUT",
            },
          ),
        ),
      ms,
    ),
  );
}

/**
 * Ekstrak data terstruktur dari file menggunakan Azure Document Intelligence.
 * File diakses via URL blob dari Azure Blob Storage.
 *
 * Timeout: 30 detik. Jika melebihi batas, melempar error dengan code "OCR_TIMEOUT".
 * Jika Azure mengembalikan error, melempar error dengan code "OCR_ERROR".
 *
 * @param blobUrl - URL blob Azure yang dapat diakses oleh Document Intelligence
 * @returns ExtractedData dengan semua field terdefinisi (nilai bisa null jika tidak ditemukan)
 */
export async function extractFromFile(blobUrl: string): Promise<ExtractedData> {
  const endpoint = process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT;
  const apiKey = process.env.AZURE_DOC_INTELLIGENCE_KEY;

  if (!endpoint || !apiKey) {
    throw Object.assign(
      new Error(
        "AZURE_DOC_INTELLIGENCE_ENDPOINT atau AZURE_DOC_INTELLIGENCE_KEY tidak ditemukan",
      ),
      { code: "OCR_ERROR" },
    );
  }

  const client = new DocumentAnalysisClient(
    endpoint,
    new AzureKeyCredential(apiKey),
  );

  /**
   * Jalankan analisis dokumen dengan race terhadap timeout.
   * Azure SDK mengembalikan poller — kita await hasilnya langsung.
   */
  const analyzePromise = (async () => {
    const poller = await client.beginAnalyzeDocumentFromUrl(
      "prebuilt-read",
      blobUrl,
    );
    return poller.pollUntilDone();
  })();

  let result;
  try {
    result = await Promise.race([
      analyzePromise,
      createTimeoutPromise(OCR_TIMEOUT_MS),
    ]);
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === "OCR_TIMEOUT") {
      throw error;
    }
    // Error dari Azure SDK
    throw Object.assign(
      new Error(`OCR service gagal: ${error.message ?? "Unknown error"}`),
      { code: "OCR_ERROR" },
    );
  }

  // Gabungkan semua teks dari semua halaman menjadi satu string
  const rawText =
    result.pages
      ?.flatMap((page) => page.lines?.map((line) => line.content) ?? [])
      .join("\n") ?? "";

  const parsed = parseOcrText(rawText);

  return {
    materialName: parsed.materialName,
    batchNumber: parsed.batchNumber,
    expiryDate: parsed.expiryDate,
    rawText,
  };
}
