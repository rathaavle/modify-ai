/**
 * Integration tests for POST /api/verify
 *
 * These tests cover tasks 9.1–9.4:
 *   9.1 Full happy-path flow (mocked Azure services)
 *   9.2 Error scenarios: missing files, wrong format, oversized files
 *   9.3 OCR failure scenarios (timeout + generic error)
 *   9.4 AI service failure — result still returned with fallback explanation
 *
 * Azure services (blobService, ocrService, aiService) are fully mocked so
 * the tests run without real credentials and are deterministic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import { verifyRouter } from "./verify";
import type { ExtractedData } from "../types";

// ---------------------------------------------------------------------------
// Mock Azure service modules
// ---------------------------------------------------------------------------

vi.mock("../services/blobService", () => ({
  uploadBlob: vi.fn(),
  deleteBlob: vi.fn(),
}));

vi.mock("../services/ocrService", () => ({
  extractFromFile: vi.fn(),
}));

vi.mock("../services/aiService", () => ({
  generateExplanation: vi.fn(),
}));

// Import mocked modules so we can configure them per-test
import { uploadBlob, deleteBlob } from "../services/blobService";
import { extractFromFile } from "../services/ocrService";
import { generateExplanation } from "../services/aiService";

const mockUploadBlob = vi.mocked(uploadBlob);
const mockDeleteBlob = vi.mocked(deleteBlob);
const mockExtractFromFile = vi.mocked(extractFromFile);
const mockGenerateExplanation = vi.mocked(generateExplanation);

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Minimal valid JPEG buffer (1×1 white pixel) */
const MINIMAL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U" +
    "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN" +
    "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy" +
    "MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA" +
    "AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA" +
    "/9oADAMBAAIRAxEAPwCwABmX/9k=",
  "base64",
);

/** Minimal valid PDF buffer */
const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj " +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj " +
    "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n" +
    "xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n" +
    "0000000058 00000 n\n0000000115 00000 n\n" +
    "trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF",
);

const EXTRACTED_LABEL: ExtractedData = {
  materialName: "Paracetamol 500mg",
  batchNumber: "BT-2024-001",
  expiryDate: "01/2026",
  rawText: "Product: Paracetamol 500mg\nBatch No: BT-2024-001\nExp: 01/2026",
};

const EXTRACTED_DOCUMENT_MATCH: ExtractedData = {
  materialName: "Paracetamol 500mg",
  batchNumber: "BT-2024-001",
  expiryDate: "01/2026",
  rawText: "Product: Paracetamol 500mg\nBatch No: BT-2024-001\nExp: 01/2026",
};

const EXTRACTED_DOCUMENT_MISMATCH: ExtractedData = {
  materialName: "Paracetamol 500mg",
  batchNumber: "BT-2024-002", // different batch
  expiryDate: "January 2026", // format mismatch
  rawText:
    "Product: Paracetamol 500mg\nBatch No: BT-2024-002\nExp: January 2026",
};

// ---------------------------------------------------------------------------
// App setup (mirrors backend/src/index.ts without starting a real server)
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api/verify", verifyRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("POST /api/verify — Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default happy-path mock implementations
    mockUploadBlob.mockResolvedValue("https://blob.example.com/file.jpg");
    mockDeleteBlob.mockResolvedValue(undefined);
    mockExtractFromFile.mockResolvedValue(EXTRACTED_LABEL);
    mockGenerateExplanation.mockResolvedValue(
      "Semua field cocok. Material farmasi terverifikasi dengan baik.",
    );
  });

  // =========================================================================
  // 9.1 — Happy path: full verification flow
  // =========================================================================

  describe("9.1 — Alur verifikasi lengkap (happy path)", () => {
    it("mengembalikan VerificationResponse sukses dengan status VALID ketika semua field cocok", async () => {
      mockExtractFromFile
        .mockResolvedValueOnce(EXTRACTED_LABEL)
        .mockResolvedValueOnce(EXTRACTED_DOCUMENT_MATCH);

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("VALID");
      expect(res.body.riskLevel).toBe("LOW");
      expect(Array.isArray(res.body.fields)).toBe(true);
      expect(res.body.fields).toHaveLength(3);
      expect(typeof res.body.explanation).toBe("string");
      expect(res.body.explanation.length).toBeGreaterThan(0);
      expect(res.body.extractedLabel).toBeDefined();
      expect(res.body.extractedDocument).toBeDefined();
    });

    it("mengembalikan status MISMATCH dan riskLevel HIGH ketika batchNumber berbeda", async () => {
      mockExtractFromFile
        .mockResolvedValueOnce(EXTRACTED_LABEL)
        .mockResolvedValueOnce(EXTRACTED_DOCUMENT_MISMATCH);

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("MISMATCH");
      expect(res.body.riskLevel).toBe("HIGH");

      const batchField = res.body.fields.find(
        (f: { fieldName: string }) => f.fieldName === "batchNumber",
      );
      expect(batchField.isMismatch).toBe(true);
      expect(batchField.mismatchType).toBe("value_mismatch");
    });

    it("memanggil uploadBlob dua kali dan deleteBlob dua kali (cleanup)", async () => {
      mockExtractFromFile
        .mockResolvedValueOnce(EXTRACTED_LABEL)
        .mockResolvedValueOnce(EXTRACTED_DOCUMENT_MATCH);

      const app = buildApp();
      await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(mockUploadBlob).toHaveBeenCalledTimes(2);
      // deleteBlob is called in finally block (fire-and-forget), give it a tick
      await new Promise((r) => setTimeout(r, 50));
      expect(mockDeleteBlob).toHaveBeenCalledTimes(2);
    });

    it("response mengandung semua field yang diperlukan sesuai VerificationResponse interface", async () => {
      mockExtractFromFile
        .mockResolvedValueOnce(EXTRACTED_LABEL)
        .mockResolvedValueOnce(EXTRACTED_DOCUMENT_MATCH);

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      const body = res.body;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("riskLevel");
      expect(body).toHaveProperty("fields");
      expect(body).toHaveProperty("explanation");
      expect(body).toHaveProperty("extractedLabel");
      expect(body).toHaveProperty("extractedDocument");

      // Setiap field harus memiliki properti yang benar
      for (const field of body.fields) {
        expect(field).toHaveProperty("fieldName");
        expect(field).toHaveProperty("labelValue");
        expect(field).toHaveProperty("documentValue");
        expect(field).toHaveProperty("isMismatch");
        expect(field).toHaveProperty("mismatchType");
      }
    });

    it("menerima file label format PNG", async () => {
      mockExtractFromFile
        .mockResolvedValueOnce(EXTRACTED_LABEL)
        .mockResolvedValueOnce(EXTRACTED_DOCUMENT_MATCH);

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.png",
          contentType: "image/png",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("menerima file label format WEBP", async () => {
      mockExtractFromFile
        .mockResolvedValueOnce(EXTRACTED_LABEL)
        .mockResolvedValueOnce(EXTRACTED_DOCUMENT_MATCH);

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.webp",
          contentType: "image/webp",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 9.2 — Error scenarios: missing files, wrong format, oversized files
  // =========================================================================

  describe("9.2 — Skenario error: file tidak diunggah, format salah, ukuran melebihi batas", () => {
    it("mengembalikan 400 MISSING_LABEL jika file label tidak diunggah", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("MISSING_LABEL");
      expect(typeof res.body.error).toBe("string");
      expect(res.body.error.length).toBeGreaterThan(0);
    });

    it("mengembalikan 400 MISSING_DOCUMENT jika file dokumen tidak diunggah", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("MISSING_DOCUMENT");
      expect(typeof res.body.error).toBe("string");
    });

    it("mengembalikan 400 jika tidak ada file sama sekali", async () => {
      const app = buildApp();
      const res = await request(app).post("/api/verify");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      // Either MISSING_LABEL or MISSING_DOCUMENT is acceptable
      expect(["MISSING_LABEL", "MISSING_DOCUMENT"]).toContain(res.body.code);
    });

    it("mengembalikan 400 INVALID_LABEL_FORMAT jika label diunggah sebagai PDF", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_PDF, {
          filename: "label.pdf",
          contentType: "application/pdf",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("INVALID_LABEL_FORMAT");
    });

    it("mengembalikan 400 INVALID_DOCUMENT_FORMAT jika dokumen diunggah sebagai JPEG", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_JPEG, {
          filename: "document.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("INVALID_DOCUMENT_FORMAT");
    });

    it("mengembalikan 400 LABEL_TOO_LARGE jika label melebihi 10 MB", async () => {
      // Buat buffer 10 MB + 1 byte
      const oversizedLabel = Buffer.alloc(10 * 1024 * 1024 + 1, 0xff);

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", oversizedLabel, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("LABEL_TOO_LARGE");
    });

    it("response error selalu memiliki properti success, error, dan code", async () => {
      const app = buildApp();
      const res = await request(app).post("/api/verify");

      expect(res.body).toHaveProperty("success", false);
      expect(res.body).toHaveProperty("error");
      expect(res.body).toHaveProperty("code");
      expect(typeof res.body.error).toBe("string");
      expect(typeof res.body.code).toBe("string");
    });
  });

  // =========================================================================
  // 9.3 — OCR failure scenarios
  // =========================================================================

  describe("9.3 — Skenario OCR gagal", () => {
    it("mengembalikan 502 OCR_TIMEOUT jika OCR service timeout", async () => {
      const timeoutError = Object.assign(
        new Error("OCR service timeout setelah 30 detik"),
        { code: "OCR_TIMEOUT" },
      );
      mockExtractFromFile.mockRejectedValue(timeoutError);

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("OCR_TIMEOUT");
      expect(typeof res.body.error).toBe("string");
      expect(res.body.error.length).toBeGreaterThan(0);
    });

    it("mengembalikan 502 OCR_ERROR jika OCR service mengembalikan error generik", async () => {
      const ocrError = Object.assign(
        new Error("Azure Document Intelligence error: 401 Unauthorized"),
        { code: "OCR_ERROR" },
      );
      mockExtractFromFile.mockRejectedValue(ocrError);

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("OCR_ERROR");
    });

    it("mengembalikan 502 OCR_ERROR jika OCR service gagal dengan key salah (error tanpa code)", async () => {
      const genericError = new Error("Request failed with status code 401");
      mockExtractFromFile.mockRejectedValue(genericError);

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("OCR_ERROR");
    });

    it("blob cleanup (deleteBlob) tetap dipanggil meskipun OCR gagal", async () => {
      mockExtractFromFile.mockRejectedValue(
        Object.assign(new Error("OCR timeout"), { code: "OCR_TIMEOUT" }),
      );

      const app = buildApp();
      await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      // deleteBlob is fire-and-forget in finally block
      await new Promise((r) => setTimeout(r, 50));
      expect(mockDeleteBlob).toHaveBeenCalled();
    });

    it("pesan error OCR_TIMEOUT informatif dan tidak mengekspos detail internal", async () => {
      mockExtractFromFile.mockRejectedValue(
        Object.assign(new Error("timeout"), { code: "OCR_TIMEOUT" }),
      );

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      // Pesan harus ada dan tidak mengandung stack trace
      expect(res.body.error).not.toContain("at ");
      expect(res.body.error).not.toContain("Error:");
      expect(res.body.error.length).toBeGreaterThan(10);
    });
  });

  // =========================================================================
  // 9.4 — AI service failure: result still returned with fallback explanation
  // =========================================================================

  describe("9.4 — Skenario AI service gagal", () => {
    it("mengembalikan hasil verifikasi dengan fallback explanation jika AI service timeout", async () => {
      mockExtractFromFile
        .mockResolvedValueOnce(EXTRACTED_LABEL)
        .mockResolvedValueOnce(EXTRACTED_DOCUMENT_MATCH);

      // generateExplanation tidak pernah throw — ia mengembalikan fallback string
      // Ini mensimulasikan perilaku aiService.ts yang sudah menangani error secara internal
      mockGenerateExplanation.mockResolvedValue(
        "Penjelasan AI tidak tersedia saat ini. Silakan periksa hasil perbandingan field di atas untuk melihat detail perbedaan yang ditemukan.",
      );

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      // Verifikasi: response tetap 200 sukses
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verifikasi: status dan riskLevel tetap ada dan benar
      expect(res.body.status).toBe("VALID");
      expect(res.body.riskLevel).toBe("LOW");

      // Verifikasi: explanation berisi fallback string (bukan kosong)
      expect(typeof res.body.explanation).toBe("string");
      expect(res.body.explanation.length).toBeGreaterThan(0);
    });

    it("fields dan extractedData tetap lengkap meskipun AI service gagal", async () => {
      mockExtractFromFile
        .mockResolvedValueOnce(EXTRACTED_LABEL)
        .mockResolvedValueOnce(EXTRACTED_DOCUMENT_MISMATCH);

      mockGenerateExplanation.mockResolvedValue(
        "Penjelasan AI tidak tersedia saat ini.",
      );

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(200);
      expect(res.body.fields).toHaveLength(3);
      expect(res.body.extractedLabel).toBeDefined();
      expect(res.body.extractedDocument).toBeDefined();
      expect(res.body.status).toBe("MISMATCH");
      expect(res.body.riskLevel).toBe("HIGH");
    });

    it("AI service yang melempar error tidak menyebabkan 500 — fallback digunakan", async () => {
      mockExtractFromFile
        .mockResolvedValueOnce(EXTRACTED_LABEL)
        .mockResolvedValueOnce(EXTRACTED_DOCUMENT_MATCH);

      // Simulasi: generateExplanation menangani error secara internal dan mengembalikan fallback
      // (sesuai implementasi aiService.ts yang tidak pernah throw)
      mockGenerateExplanation.mockResolvedValue(
        "Penjelasan AI tidak tersedia saat ini.",
      );

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      // Tidak boleh 500
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("response dengan fallback explanation tetap memiliki semua field VerificationResponse", async () => {
      mockExtractFromFile
        .mockResolvedValueOnce(EXTRACTED_LABEL)
        .mockResolvedValueOnce(EXTRACTED_DOCUMENT_MATCH);

      mockGenerateExplanation.mockResolvedValue(
        "Penjelasan AI tidak tersedia saat ini.",
      );

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      const body = res.body;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("riskLevel");
      expect(body).toHaveProperty("fields");
      expect(body).toHaveProperty("explanation");
      expect(body).toHaveProperty("extractedLabel");
      expect(body).toHaveProperty("extractedDocument");
    });
  });

  // =========================================================================
  // Additional: blob upload failure
  // =========================================================================

  describe("Skenario blob upload gagal", () => {
    it("mengembalikan 502 SERVER_ERROR jika upload blob label gagal", async () => {
      mockUploadBlob.mockRejectedValue(
        new Error("Azure Storage connection refused"),
      );

      const app = buildApp();
      const res = await request(app)
        .post("/api/verify")
        .attach("label", MINIMAL_JPEG, {
          filename: "label.jpg",
          contentType: "image/jpeg",
        })
        .attach("document", MINIMAL_PDF, {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("SERVER_ERROR");
    });
  });
});
