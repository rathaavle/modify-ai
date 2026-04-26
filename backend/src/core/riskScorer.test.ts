import { describe, it, expect } from "vitest";
import { scoreRisk } from "./riskScorer";
import type { FieldComparison, RiskLevel } from "../types";

// Helper untuk membuat FieldComparison dengan value_mismatch
function makeValueMismatch(
  fieldName: FieldComparison["fieldName"],
): FieldComparison {
  return {
    fieldName,
    labelValue: "A",
    documentValue: "B",
    isMismatch: true,
    mismatchType: "value_mismatch",
  };
}

// Helper untuk membuat FieldComparison dengan format_mismatch
function makeFormatMismatch(
  fieldName: FieldComparison["fieldName"],
): FieldComparison {
  return {
    fieldName,
    labelValue: "01/2026",
    documentValue: "January 2026",
    isMismatch: true,
    mismatchType: "format_mismatch",
  };
}

// Helper untuk membuat FieldComparison dengan missing_data
function makeMissingData(
  fieldName: FieldComparison["fieldName"],
): FieldComparison {
  return {
    fieldName,
    labelValue: null,
    documentValue: "B",
    isMismatch: true,
    mismatchType: "missing_data",
  };
}

// Helper untuk membuat FieldComparison tanpa mismatch
function makeNoMismatch(
  fieldName: FieldComparison["fieldName"],
): FieldComparison {
  return {
    fieldName,
    labelValue: "A",
    documentValue: "A",
    isMismatch: false,
    mismatchType: null,
  };
}

describe("scoreRisk", () => {
  it("1. HIGH risk: ada value_mismatch pada batchNumber", () => {
    const fields: FieldComparison[] = [
      makeNoMismatch("materialName"),
      makeValueMismatch("batchNumber"),
      makeNoMismatch("expiryDate"),
    ];
    expect(scoreRisk(fields)).toBe("HIGH");
  });

  it("2. HIGH risk: ada value_mismatch pada materialName", () => {
    const fields: FieldComparison[] = [
      makeValueMismatch("materialName"),
      makeNoMismatch("batchNumber"),
      makeNoMismatch("expiryDate"),
    ];
    expect(scoreRisk(fields)).toBe("HIGH");
  });

  it("3. MEDIUM risk: hanya ada format_mismatch", () => {
    const fields: FieldComparison[] = [
      makeNoMismatch("materialName"),
      makeNoMismatch("batchNumber"),
      makeFormatMismatch("expiryDate"),
    ];
    expect(scoreRisk(fields)).toBe("MEDIUM");
  });

  it("4. MEDIUM risk: hanya ada missing_data", () => {
    const fields: FieldComparison[] = [
      makeNoMismatch("materialName"),
      makeMissingData("batchNumber"),
      makeNoMismatch("expiryDate"),
    ];
    expect(scoreRisk(fields)).toBe("MEDIUM");
  });

  it("5. LOW risk: tidak ada mismatch", () => {
    const fields: FieldComparison[] = [
      makeNoMismatch("materialName"),
      makeNoMismatch("batchNumber"),
      makeNoMismatch("expiryDate"),
    ];
    expect(scoreRisk(fields)).toBe("LOW");
  });

  it("6. Exactly one risk level: output selalu salah satu dari HIGH/MEDIUM/LOW", () => {
    const validRiskLevels: RiskLevel[] = ["HIGH", "MEDIUM", "LOW"];

    const testCases: FieldComparison[][] = [
      [
        makeNoMismatch("materialName"),
        makeNoMismatch("batchNumber"),
        makeNoMismatch("expiryDate"),
      ],
      [
        makeValueMismatch("batchNumber"),
        makeNoMismatch("materialName"),
        makeNoMismatch("expiryDate"),
      ],
      [
        makeFormatMismatch("expiryDate"),
        makeNoMismatch("materialName"),
        makeNoMismatch("batchNumber"),
      ],
      [
        makeMissingData("materialName"),
        makeNoMismatch("batchNumber"),
        makeNoMismatch("expiryDate"),
      ],
    ];

    for (const fields of testCases) {
      const result = scoreRisk(fields);
      expect(validRiskLevels).toContain(result);
    }
  });

  it("7. HIGH priority: jika ada value_mismatch DAN format_mismatch → tetap HIGH", () => {
    const fields: FieldComparison[] = [
      makeValueMismatch("materialName"),
      makeNoMismatch("batchNumber"),
      makeFormatMismatch("expiryDate"),
    ];
    expect(scoreRisk(fields)).toBe("HIGH");
  });
});
