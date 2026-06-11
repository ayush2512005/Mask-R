import { PiiType } from '../types/redaction.types.js';
import { SystemProfileId } from '../types/profile.types.js';
import { MaskingStyle } from '../types/redaction.types.js';
import type { RedactionProfile } from '../types/profile.types.js';

export const ALL_PII_TYPES: PiiType[] = Object.values(PiiType);

export const SYSTEM_PROFILES: RedactionProfile[] = [
  {
    id: SystemProfileId.LEGAL_NDA,
    name: 'Legal NDA Mode',
    piiTypes: [PiiType.NAME, PiiType.EMAIL, PiiType.PHONE, PiiType.ADDRESS],
    customTerms: [],
    maskingStyle: MaskingStyle.BLACK_BOX,
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: SystemProfileId.HR_DOCUMENT,
    name: 'HR Document Mode',
    piiTypes: [PiiType.NAME, PiiType.EMAIL, PiiType.PHONE, PiiType.ADDRESS, PiiType.DATE_OF_BIRTH, PiiType.SSN],
    customTerms: [],
    maskingStyle: MaskingStyle.BLACK_BOX,
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: SystemProfileId.GDPR_SAR,
    name: 'GDPR SAR Mode',
    piiTypes: ALL_PII_TYPES,
    customTerms: [],
    maskingStyle: MaskingStyle.REDACTED_LABEL,
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: SystemProfileId.MEDICAL_RECORD,
    name: 'Medical Record Mode',
    piiTypes: [PiiType.NAME, PiiType.DATE_OF_BIRTH, PiiType.ADDRESS, PiiType.PHONE, PiiType.SSN],
    customTerms: [],
    maskingStyle: MaskingStyle.BLACK_BOX,
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
