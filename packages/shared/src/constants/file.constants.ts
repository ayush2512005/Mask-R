import { SupportedFileType } from '../types/file.types.js';

export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;
export const VIDEO_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
export const SERVER_FALLBACK_THRESHOLD_BYTES = 50 * 1024 * 1024;
export const VIDEO_SERVER_THRESHOLD_BYTES = 100 * 1024 * 1024;
export const MAX_WASM_BUNDLE_SIZE_BYTES = 5 * 1024 * 1024;

export const SUPPORTED_MIME_TYPES: Record<string, SupportedFileType> = {
  'application/pdf': SupportedFileType.PDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': SupportedFileType.DOCX,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': SupportedFileType.XLSX,
  'image/jpeg': SupportedFileType.JPEG,
  'image/png': SupportedFileType.PNG,
  'image/webp': SupportedFileType.WEBP,
  'image/tiff': SupportedFileType.TIFF,
  'image/bmp': SupportedFileType.BMP,
  'video/mp4': SupportedFileType.MP4,
  'video/quicktime': SupportedFileType.MOV,
  'video/webm': SupportedFileType.WEBM,
  'video/x-msvideo': SupportedFileType.AVI,
  'video/avi': SupportedFileType.AVI,
};

export const SUPPORTED_EXTENSIONS: Record<string, SupportedFileType> = {
  '.pdf': SupportedFileType.PDF,
  '.docx': SupportedFileType.DOCX,
  '.xlsx': SupportedFileType.XLSX,
  '.jpg': SupportedFileType.JPEG,
  '.jpeg': SupportedFileType.JPEG,
  '.png': SupportedFileType.PNG,
  '.webp': SupportedFileType.WEBP,
  '.tiff': SupportedFileType.TIFF,
  '.tif': SupportedFileType.TIFF,
  '.bmp': SupportedFileType.BMP,
  '.mp4': SupportedFileType.MP4,
  '.mov': SupportedFileType.MOV,
  '.webm': SupportedFileType.WEBM,
  '.avi': SupportedFileType.AVI,
};
