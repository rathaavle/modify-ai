import { BlobServiceClient } from "@azure/storage-blob";

/**
 * Inisialisasi BlobServiceClient dari environment variable.
 * Diinisialisasi sekali dan di-reuse untuk semua operasi.
 */
function getBlobServiceClient(): BlobServiceClient {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      "AZURE_STORAGE_CONNECTION_STRING tidak ditemukan di environment variables",
    );
  }
  return BlobServiceClient.fromConnectionString(connectionString);
}

/**
 * Dapatkan nama container dari environment variable.
 */
function getContainerName(): string {
  return process.env.AZURE_STORAGE_CONTAINER_NAME || "uploads";
}

/**
 * Upload buffer ke Azure Blob Storage.
 *
 * @param buffer - Konten file sebagai Buffer
 * @param filename - Nama file yang akan digunakan sebagai blob name
 * @param mimeType - MIME type file (misal: "image/jpeg", "application/pdf")
 * @returns URL blob yang dapat diakses oleh Azure Document Intelligence
 */
export async function uploadBlob(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const blobServiceClient = getBlobServiceClient();
  const containerName = getContainerName();

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(filename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType,
    },
  });

  // Kembalikan URL blob (tanpa SAS — akses via service principal atau connection string)
  return blockBlobClient.url;
}

/**
 * Hapus blob dari Azure Blob Storage.
 * Tidak melempar error jika blob tidak ditemukan (idempotent).
 *
 * @param filename - Nama blob yang akan dihapus
 */
export async function deleteBlob(filename: string): Promise<void> {
  const blobServiceClient = getBlobServiceClient();
  const containerName = getContainerName();

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(filename);

  // deleteIfExists agar tidak error jika blob sudah tidak ada
  await blockBlobClient.deleteIfExists();
}
