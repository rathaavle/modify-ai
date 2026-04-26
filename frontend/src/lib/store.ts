import { writable } from "svelte/store";
import type { VerificationResponse } from "./types";

/**
 * true saat request verifikasi sedang berjalan
 */
export const isLoading = writable<boolean>(false);

/**
 * Hasil verifikasi yang berhasil, atau null jika belum ada
 */
export const result = writable<VerificationResponse | null>(null);

/**
 * Pesan error yang ditampilkan ke user, atau null jika tidak ada error
 */
export const error = writable<string | null>(null);

/**
 * Reset semua state ke kondisi awal
 */
export function resetState(): void {
  isLoading.set(false);
  result.set(null);
  error.set(null);
}
