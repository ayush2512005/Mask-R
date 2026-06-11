import type { MaskingStyle, PiiType } from './redaction.types.js';

export interface RedactionProfile {
  id: string;
  name: string;
  piiTypes: PiiType[];
  customTerms: string[];
  maskingStyle: MaskingStyle;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum SystemProfileId {
  LEGAL_NDA = 'system-legal-nda',
  HR_DOCUMENT = 'system-hr-document',
  GDPR_SAR = 'system-gdpr-sar',
  MEDICAL_RECORD = 'system-medical-record',
}
