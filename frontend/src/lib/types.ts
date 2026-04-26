// TypeScript types — mirrored from backend/src/types.ts

export type Status = "VALID" | "MISMATCH" | "SUSPICIOUS";
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
export type FieldName = "materialName" | "batchNumber" | "expiryDate";
export type MismatchType =
  | "value_mismatch"
  | "format_mismatch"
  | "missing_data"
  | null;

export interface ExtractedData {
  materialName: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  rawText: string;
}

export interface FieldComparison {
  fieldName: FieldName;
  labelValue: string | null;
  documentValue: string | null;
  isMismatch: boolean;
  mismatchType: MismatchType;
}

export interface ValidationResult {
  status: Status;
  riskLevel: RiskLevel;
  fields: FieldComparison[];
}

export interface VerificationResponse {
  success: true;
  status: Status;
  riskLevel: RiskLevel;
  fields: FieldComparison[];
  explanation: string;
  extractedLabel: ExtractedData;
  extractedDocument: ExtractedData;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}
