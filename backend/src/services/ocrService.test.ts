import { describe, it, expect } from "vitest";
import { parseOcrText } from "./ocrService";
import type { ExtractedData } from "../types";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Verifikasi Property 5: Structured Output Invariant.
 * Semua field pada ExtractedData harus selalu terdefinisi (tidak undefined),
 * meskipun nilainya null.
 */
function assertStructuredOutput(result: Omit<ExtractedData, "rawText">): void {
  expect(result).toHaveProperty("materialName");
  expect(result).toHaveProperty("batchNumber");
  expect(result).toHaveProperty("expiryDate");

  // Nilai harus string atau null — tidak boleh undefined
  expect(
    result.materialName === null || typeof result.materialName === "string",
  ).toBe(true);
  expect(
    result.batchNumber === null || typeof result.batchNumber === "string",
  ).toBe(true);
  expect(
    result.expiryDate === null || typeof result.expiryDate === "string",
  ).toBe(true);
}

// ─── Property 5: Structured Output Invariant ────────────────────────────────

describe("parseOcrText — Property 5: Structured Output Invariant", () => {
  it("string kosong: semua field terdefinisi (null)", () => {
    const result = parseOcrText("");
    assertStructuredOutput(result);
    expect(result.materialName).toBeNull();
    expect(result.batchNumber).toBeNull();
    expect(result.expiryDate).toBeNull();
  });

  it("teks acak tanpa field yang dikenali: semua field terdefinisi (null)", () => {
    const result = parseOcrText("Lorem ipsum dolor sit amet consectetur");
    assertStructuredOutput(result);
  });

  it("teks dengan semua field lengkap: semua field terdefinisi (string)", () => {
    const rawText = `
      Product: Paracetamol 500mg
      Batch No: BT-2024-001
      Exp: 01/2026
    `;
    const result = parseOcrText(rawText);
    assertStructuredOutput(result);
    expect(result.materialName).not.toBeNull();
    expect(result.batchNumber).not.toBeNull();
    expect(result.expiryDate).not.toBeNull();
  });

  it("teks dengan hanya batchNumber: field lain null, batchNumber terdefinisi", () => {
    const result = parseOcrText("Lot No: ABC-123");
    assertStructuredOutput(result);
    expect(result.batchNumber).not.toBeNull();
    expect(result.materialName).toBeNull();
    expect(result.expiryDate).toBeNull();
  });

  it("teks dengan hanya expiryDate: field lain null, expiryDate terdefinisi", () => {
    const result = parseOcrText("Expiry Date: January 2026");
    assertStructuredOutput(result);
    expect(result.expiryDate).not.toBeNull();
    expect(result.materialName).toBeNull();
    expect(result.batchNumber).toBeNull();
  });

  it("teks dengan hanya materialName: field lain null, materialName terdefinisi", () => {
    const result = parseOcrText("Material Name: Ibuprofen 200mg");
    assertStructuredOutput(result);
    expect(result.materialName).not.toBeNull();
    expect(result.batchNumber).toBeNull();
    expect(result.expiryDate).toBeNull();
  });
});

// ─── Batch Number Extraction ─────────────────────────────────────────────────

describe("parseOcrText — batchNumber extraction", () => {
  it("mengenali 'Batch No: BT-2024-001'", () => {
    const result = parseOcrText("Batch No: BT-2024-001");
    expect(result.batchNumber).toBe("BT-2024-001");
  });

  it("mengenali 'LOT: 12345A' (case-insensitive)", () => {
    const result = parseOcrText("LOT: 12345A");
    expect(result.batchNumber).toBe("12345A");
  });

  it("mengenali 'Lot No. XYZ-99'", () => {
    const result = parseOcrText("Lot No. XYZ-99");
    expect(result.batchNumber).toBe("XYZ-99");
  });

  it("mengenali 'B.No. ABC123'", () => {
    const result = parseOcrText("B.No. ABC123");
    expect(result.batchNumber).toBe("ABC123");
  });

  it("mengembalikan null jika tidak ada batch number", () => {
    const result = parseOcrText("Product: Paracetamol\nExp: 01/2026");
    expect(result.batchNumber).toBeNull();
  });
});

// ─── Expiry Date Extraction ──────────────────────────────────────────────────

describe("parseOcrText — expiryDate extraction", () => {
  it("mengenali 'Exp: 01/2026'", () => {
    const result = parseOcrText("Exp: 01/2026");
    expect(result.expiryDate).toBe("01/2026");
  });

  it("mengenali 'Expiry Date: January 2026'", () => {
    const result = parseOcrText("Expiry Date: January 2026");
    expect(result.expiryDate).toBe("January 2026");
  });

  it("mengenali 'Best Before: 2026-01-31'", () => {
    const result = parseOcrText("Best Before: 2026-01-31");
    expect(result.expiryDate).toBe("2026-01-31");
  });

  it("mengenali 'Expiration Date: 12/2025'", () => {
    const result = parseOcrText("Expiration Date: 12/2025");
    expect(result.expiryDate).toBe("12/2025");
  });

  it("mengembalikan null jika tidak ada expiry date", () => {
    const result = parseOcrText("Product: Paracetamol\nBatch No: BT-001");
    expect(result.expiryDate).toBeNull();
  });
});

// ─── Material Name Extraction ────────────────────────────────────────────────

describe("parseOcrText — materialName extraction", () => {
  it("mengenali 'Product: Paracetamol 500mg'", () => {
    const result = parseOcrText("Product: Paracetamol 500mg");
    expect(result.materialName).toBe("Paracetamol 500mg");
  });

  it("mengenali 'Material Name: Ibuprofen 200mg'", () => {
    const result = parseOcrText("Material Name: Ibuprofen 200mg");
    expect(result.materialName).toBe("Ibuprofen 200mg");
  });

  it("mengenali 'Item Name: Amoxicillin 250mg'", () => {
    const result = parseOcrText("Item Name: Amoxicillin 250mg");
    expect(result.materialName).toBe("Amoxicillin 250mg");
  });

  it("mengenali 'Nama Produk: Parasetamol 500mg' (Bahasa Indonesia)", () => {
    const result = parseOcrText("Nama Produk: Parasetamol 500mg");
    expect(result.materialName).toBe("Parasetamol 500mg");
  });

  it("mengembalikan null jika tidak ada material name", () => {
    const result = parseOcrText("Batch No: BT-001\nExp: 01/2026");
    expect(result.materialName).toBeNull();
  });
});

// ─── Multi-field Extraction ──────────────────────────────────────────────────

describe("parseOcrText — multi-field extraction dari teks realistis", () => {
  it("mengekstrak semua field dari teks label farmasi lengkap", () => {
    const rawText = `
CERTIFICATE OF ANALYSIS
Product: Paracetamol 500mg Tablet
Batch No: BT-2024-001
Manufacturing Date: 01/2024
Expiry Date: 01/2026
Manufacturer: PT Pharma Indonesia
    `;
    const result = parseOcrText(rawText);
    assertStructuredOutput(result);
    expect(result.materialName).toBe("Paracetamol 500mg Tablet");
    expect(result.batchNumber).toBe("BT-2024-001");
    expect(result.expiryDate).toBe("01/2026");
  });

  it("mengekstrak field dari teks dengan format LOT dan Exp singkat", () => {
    const rawText = `
Ibuprofen 400mg
LOT: IBU-400-2024
Exp: 06/2025
    `;
    const result = parseOcrText(rawText);
    assertStructuredOutput(result);
    expect(result.batchNumber).toBe("IBU-400-2024");
    expect(result.expiryDate).toBe("06/2025");
  });

  it("structured output invariant tetap terpenuhi untuk berbagai input", () => {
    const testInputs = [
      "",
      "random text",
      "Batch No: ABC",
      "Exp: 01/2026",
      "Product: Test\nLot: 123\nBest Before: December 2025",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890 !@#$%",
      "Nama Material: Amoksisilin\nB.No. AMX-001\nBB. 2026-12-31",
    ];

    for (const input of testInputs) {
      const result = parseOcrText(input);
      assertStructuredOutput(result);
    }
  });
});
