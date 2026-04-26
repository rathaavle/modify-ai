import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { uploadBlob, deleteBlob } from "../services/blobService";
import { extractFromFile } from "../services/ocrService";
import { compareFields, determineStatus } from "../core/validator";
import { scoreRisk } from "../core/riskScorer";
import { generateExplanation } from "../services/aiService";
import type {
  ErrorResponse,
  VerificationResponse,
  ValidationResult,
} from "../types";

// ---------------------------------------------------------------------------
// Konstanta batas ukuran file
// ---------------------------------------------------------------------------
const LABEL_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const DOCUMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// MIME types yang diterima untuk masing-masing field
const ALLOWED_LABEL_MIMETYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_DOCUMENT_MIMETYPES = new Set(["application/pdf"]);

// ---------------------------------------------------------------------------
// Konfigurasi multer — simpan file di memory (buffer), bukan disk
// ---------------------------------------------------------------------------

/**
 * Filter multer: tolak file yang MIME type-nya tidak dikenali sama sekali.
 * Validasi format spesifik per-field dilakukan di handler setelah upload.
 */
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const isLabel = file.fieldname === "label";
  const isDocument = file.fieldname === "document";

  if (isLabel && ALLOWED_LABEL_MIMETYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  if (isDocument && ALLOWED_DOCUMENT_MIMETYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  // Tolak file dengan format tidak didukung
  // Kita lempar error dengan informasi field agar bisa dibedakan di handler
  const err = Object.assign(
    new Error(
      isLabel
        ? "Format file label tidak didukung. Format yang diterima: JPG, PNG, WEBP."
        : isDocument
          ? "Format file dokumen tidak didukung. Format yang diterima: PDF."
          : "Format file tidak didukung.",
    ),
    {
      code: isLabel
        ? "INVALID_LABEL_FORMAT"
        : isDocument
          ? "INVALID_DOCUMENT_FORMAT"
          : "INVALID_FORMAT",
    },
  );
  cb(err as unknown as null, false);
};

/**
 * Multer dikonfigurasi dengan:
 * - storage: memoryStorage (file tersimpan di buffer, tidak ke disk)
 * - limits: ukuran maksimum menggunakan nilai terbesar (20 MB) — validasi
 *   per-field dilakukan secara manual di handler karena multer tidak
 *   mendukung limit berbeda per field secara native.
 * - fileFilter: tolak MIME type yang tidak dikenali
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: DOCUMENT_MAX_SIZE_BYTES, // batas atas global; per-field dicek manual
    files: 2,
  },
  fileFilter,
});

// ---------------------------------------------------------------------------
// Helper: kirim ErrorResponse
// ---------------------------------------------------------------------------
function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
): void {
  const body: ErrorResponse = { success: false, error: message, code };
  res.status(status).json(body);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export const verifyRouter = Router();

/**
 * POST /api/verify
 *
 * Menerima dua file (label + document), menjalankan pipeline:
 *   upload blob → OCR → hapus blob (finally) → validator → risk scorer → AI → response
 */
verifyRouter.post(
  "/",
  upload.fields([
    { name: "label", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    // Nama blob yang diupload — digunakan di blok finally untuk cleanup
    const uploadedBlobs: string[] = [];

    try {
      // -----------------------------------------------------------------------
      // 5.2 Validasi server-side: keberadaan, format, dan ukuran file
      // -----------------------------------------------------------------------
      const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | undefined;

      const labelFile = files?.["label"]?.[0];
      const documentFile = files?.["document"]?.[0];

      // Keberadaan file
      if (!labelFile) {
        sendError(
          res,
          400,
          "MISSING_LABEL",
          "File label wajib diunggah sebelum memulai verifikasi.",
        );
        return;
      }

      if (!documentFile) {
        sendError(
          res,
          400,
          "MISSING_DOCUMENT",
          "File dokumen pendukung wajib diunggah sebelum memulai verifikasi.",
        );
        return;
      }

      // Validasi format label (double-check setelah fileFilter)
      if (!ALLOWED_LABEL_MIMETYPES.has(labelFile.mimetype)) {
        sendError(
          res,
          400,
          "INVALID_LABEL_FORMAT",
          "Format file label tidak didukung. Format yang diterima: JPG, PNG, WEBP.",
        );
        return;
      }

      // Validasi format dokumen
      if (!ALLOWED_DOCUMENT_MIMETYPES.has(documentFile.mimetype)) {
        sendError(
          res,
          400,
          "INVALID_DOCUMENT_FORMAT",
          "Format file dokumen tidak didukung. Format yang diterima: PDF.",
        );
        return;
      }

      // Validasi ukuran label (max 10 MB)
      if (labelFile.size > LABEL_MAX_SIZE_BYTES) {
        sendError(
          res,
          400,
          "LABEL_TOO_LARGE",
          "Ukuran file label melebihi batas maksimum 10 MB.",
        );
        return;
      }

      // Validasi ukuran dokumen (max 20 MB)
      if (documentFile.size > DOCUMENT_MAX_SIZE_BYTES) {
        sendError(
          res,
          400,
          "DOCUMENT_TOO_LARGE",
          "Ukuran file dokumen melebihi batas maksimum 20 MB.",
        );
        return;
      }

      // -----------------------------------------------------------------------
      // 5.3 Pipeline: upload blob → OCR → hapus blob → validator → scorer → AI
      // -----------------------------------------------------------------------

      // Tentukan ekstensi file dari MIME type
      const labelExt =
        labelFile.mimetype === "image/png"
          ? "png"
          : labelFile.mimetype === "image/webp"
            ? "webp"
            : "jpg";

      const requestId = uuidv4();
      const labelBlobName = `${requestId}-label.${labelExt}`;
      const documentBlobName = `${requestId}-document.pdf`;

      // --- Upload kedua file ke Azure Blob Storage ---
      let labelBlobUrl: string;
      let documentBlobUrl: string;

      try {
        labelBlobUrl = await uploadBlob(
          labelFile.buffer,
          labelBlobName,
          labelFile.mimetype,
        );
        uploadedBlobs.push(labelBlobName);

        documentBlobUrl = await uploadBlob(
          documentFile.buffer,
          documentBlobName,
          documentFile.mimetype,
        );
        uploadedBlobs.push(documentBlobName);
      } catch (err: unknown) {
        const error = err as Error;
        console.error("[verify] Gagal upload blob:", error.message);
        sendError(
          res,
          502,
          "SERVER_ERROR",
          "Gagal mengunggah file ke storage. Silakan coba lagi.",
        );
        return;
      }

      // --- OCR: ekstrak data dari kedua file ---
      let extractedLabel;
      let extractedDocument;

      try {
        [extractedLabel, extractedDocument] = await Promise.all([
          extractFromFile(labelBlobUrl),
          extractFromFile(documentBlobUrl),
        ]);
      } catch (err: unknown) {
        const error = err as Error & { code?: string };
        console.error("[verify] OCR gagal:", error.message);

        if (error.code === "OCR_TIMEOUT") {
          sendError(
            res,
            502,
            "OCR_TIMEOUT",
            "Layanan OCR tidak merespons dalam 30 detik. Silakan coba lagi.",
          );
        } else {
          sendError(
            res,
            502,
            "OCR_ERROR",
            "Layanan OCR mengalami kesalahan. Silakan coba lagi.",
          );
        }
        return;
      }

      // --- Validator: bandingkan field ---
      const fields = compareFields(extractedLabel, extractedDocument);
      const status = determineStatus(fields);

      // --- Risk Scorer ---
      const riskLevel = scoreRisk(fields);

      const validationResult: ValidationResult = { status, riskLevel, fields };

      // --- AI Service: generate explanation (tidak pernah throw) ---
      const explanation = await generateExplanation(validationResult);

      // --- Susun response ---
      const response: VerificationResponse = {
        success: true,
        status,
        riskLevel,
        fields,
        explanation,
        extractedLabel,
        extractedDocument,
      };

      res.status(200).json(response);
    } catch (err: unknown) {
      // Tangkap error tak terduga
      const error = err as Error;
      console.error("[verify] Unexpected error:", error.message, error.stack);
      sendError(
        res,
        500,
        "SERVER_ERROR",
        "Terjadi kesalahan internal pada server. Silakan coba lagi.",
      );
    } finally {
      // --- Cleanup: hapus semua blob yang sudah diupload ---
      for (const blobName of uploadedBlobs) {
        deleteBlob(blobName).catch((err: unknown) => {
          const error = err as Error;
          console.error(
            `[verify] Gagal menghapus blob "${blobName}":`,
            error.message,
          );
        });
      }
    }
  },
);

// ---------------------------------------------------------------------------
// Error handler untuk multer (ukuran file melebihi batas global, dll.)
// ---------------------------------------------------------------------------
verifyRouter.use(
  (
    err: Error & { code?: string; field?: string },
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        // Multer melempar ini jika file melebihi batas global (20 MB)
        sendError(
          res,
          400,
          "DOCUMENT_TOO_LARGE",
          "Ukuran file melebihi batas maksimum yang diizinkan.",
        );
        return;
      }
      sendError(res, 400, "SERVER_ERROR", `Upload error: ${err.message}`);
      return;
    }

    // Error dari fileFilter (format tidak didukung)
    const customErr = err as Error & { code?: string };
    if (
      customErr.code === "INVALID_LABEL_FORMAT" ||
      customErr.code === "INVALID_DOCUMENT_FORMAT"
    ) {
      sendError(res, 400, customErr.code, customErr.message);
      return;
    }

    // Error lainnya
    console.error("[verify] Unhandled middleware error:", err);
    sendError(
      res,
      500,
      "SERVER_ERROR",
      "Terjadi kesalahan internal pada server.",
    );
  },
);
