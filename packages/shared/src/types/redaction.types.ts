export enum MaskingStyle {
  BLACK_BOX = 'BLACK_BOX',
  BLUR = 'BLUR',
  PIXELATE = 'PIXELATE',
  REDACTED_LABEL = 'REDACTED_LABEL',
  FAKE_DATA = 'FAKE_DATA',
}

export enum PiiType {
  NAME = 'NAME',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  ADDRESS = 'ADDRESS',
  CARD_NUMBER = 'CARD_NUMBER',
  DATE_OF_BIRTH = 'DATE_OF_BIRTH',
  SSN = 'SSN',
  PASSPORT = 'PASSPORT',
  IP_ADDRESS = 'IP_ADDRESS',
  CUSTOM = 'CUSTOM',
}

export interface PiiItem {
  id: string;
  type: PiiType;
  text: string;
  confidence: number;
  approved: boolean;
  pageIndex?: number;
  boundingBox?: BoundingBox;
  occurrences?: BoundingBox[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactionRegion {
  id: string;
  boundingBox: BoundingBox;
  pageIndex: number;
  maskingStyle: MaskingStyle;
  piiItemId?: string;
}

export interface RedactionConfig {
  maskingStyle: MaskingStyle;
  regions: RedactionRegion[];
  piiItems: PiiItem[];
  customTerms: string[];
  fakeDataMap?: Record<string, string>;
}

export type ProcessingStatus = 'idle' | 'loading' | 'processing' | 'success' | 'error';
