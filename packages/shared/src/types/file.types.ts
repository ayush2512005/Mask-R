export enum SupportedFileType {
  PDF = 'PDF',
  DOCX = 'DOCX',
  XLSX = 'XLSX',
  JPEG = 'JPEG',
  PNG = 'PNG',
  WEBP = 'WEBP',
  TIFF = 'TIFF',
  BMP = 'BMP',
  MP4 = 'MP4',
  MOV = 'MOV',
  WEBM = 'WEBM',
  AVI = 'AVI',
}

export interface FileMetadata {
  name: string;
  type: SupportedFileType;
  sizeBytes: number;
  pageCount?: number;
  addedAt: string;
}

export enum FileProcessingPath {
  CLIENT_SIDE = 'CLIENT_SIDE',
  SERVER_SIDE = 'SERVER_SIDE',
}
