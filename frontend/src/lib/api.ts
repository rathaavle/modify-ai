import type { VerificationResponse, ErrorResponse } from "./types";

/**
 * Mengirim request verifikasi ke backend dengan dua file (label dan dokumen)
 * @param labelFile - File gambar label (JPG/PNG/WEBP)
 * @param documentFile - File dokumen pendukung (PDF)
 * @returns Promise<VerificationResponse> jika sukses
 * @throws Error dengan pesan user-friendly jika gagal
 */
export async function verify(
  labelFile: File,
  documentFile: File,
): Promise<VerificationResponse> {
  const formData = new FormData();
  formData.append("label", labelFile);
  formData.append("document", documentFile);

  try {
    const response = await fetch("/api/verify", {
      method: "POST",
      body: formData,
    });

    // Parse response body
    const data = (await response.json()) as
      | VerificationResponse
      | ErrorResponse;

    // Jika HTTP error atau success: false
    if (!response.ok || !data.success) {
      const errorData = data as ErrorResponse;
      throw new Error(
        errorData.error || "Terjadi kesalahan saat memverifikasi file.",
      );
    }

    return data as VerificationResponse;
  } catch (err) {
    // Network error atau parsing error
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(
      "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
    );
  }
}
