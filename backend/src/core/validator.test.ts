import { describe, it, expect } from "vitest";
import { compareFields, determineStatus } from "./validator";
import type { ExtractedData } from "../types";

// Helper untuk membuat ExtractedData lengkap
function makeExtracted(
  materialName: string | null,
  batchNumber: string | null,
  expiryDate: string | null,
): ExtractedData {
  return {
    materialName,
    batchNumber,
    expiryDate,
    rawText: "",
  };
}

describe("compareFields", () => {
  it("1. Mismatch Count Invariant: jumlah isMismatch harus sama dengan jumlah field yang berbeda", () => {
    const label = makeExtracted("Paracetamol 500mg", "BT-001", "01/2026");
    const doc = makeExtracted("Paracetamol 500mg", "BT-002", "01/2026");

    const fields = compareFields(label, doc);
    const mismatchCount = fields.filter((f) => f.isMismatch).length;

    // Hanya batchNumber yang berbeda → 1 mismatch
    expect(mismatchCount).toBe(1);
  });

  it("2. Status VALID: ketika semua field sama → status VALID", () => {
    const label = makeExtracted("Paracetamol 500mg", "BT-001", "01/2026");
    const doc = makeExtracted("Paracetamol 500mg", "BT-001", "01/2026");

    const fields = compareFields(label, doc);
    const status = determineStatus(fields);

    expect(status).toBe("VALID");
    expect(fields.every((f) => !f.isMismatch)).toBe(true);
  });

  it("3. Status MISMATCH: ketika batchNumber berbeda → status MISMATCH", () => {
    const label = makeExtracted("Paracetamol 500mg", "BT-001", "01/2026");
    const doc = makeExtracted("Paracetamol 500mg", "BT-002", "01/2026");

    const fields = compareFields(label, doc);
    const status = determineStatus(fields);

    expect(status).toBe("MISMATCH");
  });

  it("4. Status SUSPICIOUS: ketika ada field null → status SUSPICIOUS", () => {
    const label = makeExtracted("Paracetamol 500mg", null, "01/2026");
    const doc = makeExtracted("Paracetamol 500mg", "BT-001", "01/2026");

    const fields = compareFields(label, doc);
    const status = determineStatus(fields);

    expect(status).toBe("SUSPICIOUS");
  });

  it("5. format_mismatch pada expiryDate: '01/2026' vs 'January 2026'", () => {
    const label = makeExtracted("Paracetamol 500mg", "BT-001", "01/2026");
    const doc = makeExtracted("Paracetamol 500mg", "BT-001", "January 2026");

    const fields = compareFields(label, doc);
    const expiryField = fields.find((f) => f.fieldName === "expiryDate");

    expect(expiryField).toBeDefined();
    expect(expiryField!.isMismatch).toBe(true);
    expect(expiryField!.mismatchType).toBe("format_mismatch");
  });

  it("6. value_mismatch pada batchNumber: 'BT-001' vs 'BT-002'", () => {
    const label = makeExtracted("Paracetamol 500mg", "BT-001", "01/2026");
    const doc = makeExtracted("Paracetamol 500mg", "BT-002", "01/2026");

    const fields = compareFields(label, doc);
    const batchField = fields.find((f) => f.fieldName === "batchNumber");

    expect(batchField).toBeDefined();
    expect(batchField!.isMismatch).toBe(true);
    expect(batchField!.mismatchType).toBe("value_mismatch");
  });

  it("7. Case-insensitive matching: 'Paracetamol' vs 'paracetamol' → tidak mismatch", () => {
    const label = makeExtracted("Paracetamol", "BT-001", "01/2026");
    const doc = makeExtracted("paracetamol", "BT-001", "01/2026");

    const fields = compareFields(label, doc);
    const materialField = fields.find((f) => f.fieldName === "materialName");

    expect(materialField).toBeDefined();
    expect(materialField!.isMismatch).toBe(false);
    expect(materialField!.mismatchType).toBeNull();
  });
});

describe("determineStatus", () => {
  it("mengembalikan VALID jika tidak ada mismatch", () => {
    const label = makeExtracted("Paracetamol", "BT-001", "01/2026");
    const doc = makeExtracted("Paracetamol", "BT-001", "01/2026");
    const fields = compareFields(label, doc);
    expect(determineStatus(fields)).toBe("VALID");
  });

  it("mengembalikan SUSPICIOUS jika ada missing_data, meskipun ada mismatch lain", () => {
    const label = makeExtracted(null, "BT-001", "01/2026");
    const doc = makeExtracted("Paracetamol", "BT-002", "01/2026");
    const fields = compareFields(label, doc);
    expect(determineStatus(fields)).toBe("SUSPICIOUS");
  });

  it("mengembalikan MISMATCH jika ada value_mismatch tanpa missing_data", () => {
    const label = makeExtracted("Paracetamol", "BT-001", "01/2026");
    const doc = makeExtracted("Ibuprofen", "BT-001", "01/2026");
    const fields = compareFields(label, doc);
    expect(determineStatus(fields)).toBe("MISMATCH");
  });
});
