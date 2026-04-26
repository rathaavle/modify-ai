import type {
  ExtractedData,
  FieldComparison,
  FieldName,
  MismatchType,
  Status,
} from "../types";

/**
 * Cek apakah dua nilai expiryDate hanya berbeda format (bukan nilai).
 * Strategi: cek apakah keduanya mengandung angka tahun yang sama.
 */
function isFormatMismatch(a: string, b: string): boolean {
  const yearPattern = /\b(20\d{2}|19\d{2})\b/;
  const yearA = a.match(yearPattern)?.[1];
  const yearB = b.match(yearPattern)?.[1];
  return yearA !== undefined && yearB !== undefined && yearA === yearB;
}

/**
 * Bandingkan satu field antara label dan dokumen.
 */
function compareField(
  fieldName: FieldName,
  labelValue: string | null,
  documentValue: string | null,
): FieldComparison {
  // Salah satu null → missing_data
  if (labelValue === null || documentValue === null) {
    return {
      fieldName,
      labelValue,
      documentValue,
      isMismatch: true,
      mismatchType: "missing_data",
    };
  }

  const normalizedLabel = labelValue.trim().toLowerCase();
  const normalizedDocument = documentValue.trim().toLowerCase();

  // Nilai sama persis (case-insensitive, trimmed) → tidak mismatch
  if (normalizedLabel === normalizedDocument) {
    return {
      fieldName,
      labelValue,
      documentValue,
      isMismatch: false,
      mismatchType: null,
    };
  }

  // Untuk expiryDate: cek apakah hanya format yang berbeda
  if (
    fieldName === "expiryDate" &&
    isFormatMismatch(labelValue, documentValue)
  ) {
    return {
      fieldName,
      labelValue,
      documentValue,
      isMismatch: true,
      mismatchType: "format_mismatch",
    };
  }

  // Nilai berbeda secara substansial
  return {
    fieldName,
    labelValue,
    documentValue,
    isMismatch: true,
    mismatchType: "value_mismatch",
  };
}

/**
 * Bandingkan ketiga field antara label dan dokumen.
 * Mengembalikan array FieldComparison untuk setiap field.
 */
export function compareFields(
  label: ExtractedData,
  document: ExtractedData,
): FieldComparison[] {
  const fields: FieldName[] = ["materialName", "batchNumber", "expiryDate"];
  return fields.map((fieldName) =>
    compareField(fieldName, label[fieldName], document[fieldName]),
  );
}

/**
 * Tentukan status berdasarkan hasil perbandingan field.
 * - VALID: tidak ada mismatch
 * - SUSPICIOUS: ada field dengan missing_data
 * - MISMATCH: ada mismatch selain missing_data
 */
export function determineStatus(fields: FieldComparison[]): Status {
  const hasMissingData = fields.some((f) => f.mismatchType === "missing_data");
  const hasOtherMismatch = fields.some(
    (f) => f.isMismatch && f.mismatchType !== "missing_data",
  );

  if (hasMissingData) {
    return "SUSPICIOUS";
  }

  if (hasOtherMismatch) {
    return "MISMATCH";
  }

  return "VALID";
}
