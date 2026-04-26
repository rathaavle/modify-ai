// Status types
export type Status = "VALID" | "MISMATCH" | "SUSPICIOUS";
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
export type FieldName = "materialName" | "batchNumber" | "expiryDate";
export type MismatchType =
  | "value_mismatch"
  | "format_mismatch"
  | "missing_data"
  | null;

// Hasil parsing dari OCR untuk satu dokumen
export interface ExtractedData {
  materialName: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  rawText: string;
}

// Hasil perbandingan satu field antara Label dan Supporting Document
export interface FieldComparison {
  fieldName: FieldName;
  labelValue: string | null;
  documentValue: string | null;
  isMismatch: boolean;
  mismatchType: MismatchType;
}

// Output lengkap dari proses validasi sebelum AI explanation
export interface ValidationResult {
  status: Status;
  riskLevel: RiskLevel;
  fields: FieldComparison[];
}

// Response final dari backend ke frontend
export interface VerificationResponse {
  success: true;
  status: Status;
  riskLevel: RiskLevel;
  fields: FieldComparison[];
  explanation: string;
  extractedLabel: ExtractedData;
  extractedDocument: ExtractedData;
}

// Response ketika terjadi error
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}
