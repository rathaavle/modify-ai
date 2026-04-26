import type {
  ExtractedData,
  FieldComparison,
  FieldName,
  MismatchType,
  Status,
} from "../types";

/** Map nama bulan ke nomor bulan (2 digit) */
const MONTH_MAP: Record<string, string> = {
  january: "01",
  jan: "01",
  february: "02",
  feb: "02",
  march: "03",
  mar: "03",
  april: "04",
  apr: "04",
  may: "05",
  june: "06",
  jun: "06",
  july: "07",
  jul: "07",
  august: "08",
  aug: "08",
  september: "09",
  sep: "09",
  sept: "09",
  october: "10",
  oct: "10",
  november: "11",
  nov: "11",
  december: "12",
  dec: "12",
};

/**
 * Normalisasi tanggal kedaluwarsa ke format "MM/YYYY".
 * Menangani berbagai format: "01/2026", "January 2026", "2026-01", "Jan 2026", dll.
 * Mengembalikan null jika tidak bisa di-parse.
 */
function normalizeExpiryDate(value: string): string | null {
  const v = value.trim().toLowerCase();

  // Format: "MM/YYYY" atau "MM-YYYY"
  const mmYyyy = v.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (mmYyyy) return `${mmYyyy[1].padStart(2, "0")}/${mmYyyy[2]}`;

  // Format: "YYYY/MM" atau "YYYY-MM"
  const yyyyMm = v.match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (yyyyMm) return `${yyyyMm[2].padStart(2, "0")}/${yyyyMm[1]}`;

  // Format: "Month YYYY" atau "YYYY Month"
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    const monthYear = v.match(new RegExp(`^${name}\\s+(\\d{4})$`));
    if (monthYear) return `${num}/${monthYear[1]}`;

    const yearMonth = v.match(new RegExp(`^(\\d{4})\\s+${name}$`));
    if (yearMonth) return `${num}/${yearMonth[1]}`;
  }

  return null;
}

/**
 * Cek apakah dua nilai expiryDate sama secara semantik (meski format berbeda).
 * Contoh: "01/2026" == "January 2026" == "2026-01"
 */
function isSameExpiryDate(a: string, b: string): boolean {
  const normA = normalizeExpiryDate(a);
  const normB = normalizeExpiryDate(b);
  if (normA && normB) return normA === normB;
  // Fallback: cek tahun sama
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

  // Untuk expiryDate: cek apakah nilainya sama secara semantik
  if (
    fieldName === "expiryDate" &&
    isSameExpiryDate(labelValue, documentValue)
  ) {
    return {
      fieldName,
      labelValue,
      documentValue,
      isMismatch: false,
      mismatchType: null,
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
