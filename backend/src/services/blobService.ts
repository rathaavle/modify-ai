import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

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
 * Parse AccountName dan AccountKey dari connection string.
 * Digunakan untuk membuat SAS token.
 */
function parseConnectionString(connectionString: string): {
  accountName: string;
  accountKey: string;
} {
  const accountNameMatch = connectionString.match(/AccountName=([^;]+)/);
  const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);

  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error(
      "Connection string tidak valid: AccountName atau AccountKey tidak ditemukan",
    );
  }

  return {
    accountName: accountNameMatch[1],
    accountKey: accountKeyMatch[1],
  };
}

/**
 * Dapatkan nama container dari environment variable.
 */
function getContainerName(): string {
  return process.env.AZURE_STORAGE_CONTAINER_NAME || "uploads";
}

/**
 * Upload buffer ke Azure Blob Storage dan kembalikan SAS URL.
 * SAS URL berlaku selama 10 menit — cukup untuk proses OCR selesai.
 *
 * @param buffer - Konten file sebagai Buffer
 * @param filename - Nama file yang akan digunakan sebagai blob name
 * @param mimeType - MIME type file (misal: "image/jpeg", "application/pdf")
 * @returns SAS URL yang dapat diakses oleh Azure Document Intelligence
 */
export async function uploadBlob(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING tidak ditemukan");
  }

  const blobServiceClient = getBlobServiceClient();
  const containerName = getContainerName();

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(filename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType,
    },
  });

  // Generate SAS token yang berlaku 10 menit
  const { accountName, accountKey } = parseConnectionString(connectionString);
  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey,
  );

  const expiresOn = new Date();
  expiresOn.setMinutes(expiresOn.getMinutes() + 10);

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: filename,
      permissions: BlobSASPermissions.parse("r"), // read-only
      expiresOn,
    },
    sharedKeyCredential,
  ).toString();

  return `${blockBlobClient.url}?${sasToken}`;
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
