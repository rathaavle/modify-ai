import type { FieldComparison, RiskLevel } from "../types";

/**
 * Tentukan risk level berdasarkan hasil perbandingan field.
 *
 * Prioritas: HIGH > MEDIUM > LOW
 * - HIGH: ada value_mismatch pada materialName atau batchNumber
 * - MEDIUM: ada format_mismatch atau missing_data
 * - LOW: tidak ada mismatch sama sekali
 */
export function scoreRisk(fields: FieldComparison[]): RiskLevel {
  const hasCriticalValueMismatch = fields.some(
    (f) =>
      f.mismatchType === "value_mismatch" &&
      (f.fieldName === "materialName" || f.fieldName === "batchNumber"),
  );

  if (hasCriticalValueMismatch) {
    return "HIGH";
  }

  const hasMediumRisk = fields.some(
    (f) =>
      f.mismatchType === "format_mismatch" || f.mismatchType === "missing_data",
  );

  if (hasMediumRisk) {
    return "MEDIUM";
  }

  return "LOW";
}
