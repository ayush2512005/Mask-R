import {
  SupportedFileType,
  FileProcessingPath,
  SUPPORTED_MIME_TYPES,
  SUPPORTED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  VIDEO_MAX_FILE_SIZE_BYTES,
  SERVER_FALLBACK_THRESHOLD_BYTES,
  VIDEO_SERVER_THRESHOLD_BYTES,
} from '@redact/shared';

const VIDEO_TYPES = new Set([
  SupportedFileType.MP4,
  SupportedFileType.MOV,
  SupportedFileType.WEBM,
  SupportedFileType.AVI,
]);
import type { FileMetadata } from '@redact/shared';
import { RedactionError } from '../lib/errors';

export function detectFileType(file: File): SupportedFileType {
  const byMime = SUPPORTED_MIME_TYPES[file.type];
  if (byMime) return byMime;

  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  const byExt = SUPPORTED_EXTENSIONS[ext];
  if (byExt) return byExt;

  throw new RedactionError('UNSUPPORTED_FORMAT', `File type "${file.type || ext}" is not supported.`, {
    fileName: file.name,
    mimeType: file.type,
  });
}

export function routeFile(file: File): FileProcessingPath {
  const fileType = SUPPORTED_MIME_TYPES[file.type];
  const isVideo = fileType != null && VIDEO_TYPES.has(fileType);

  const maxBytes = isVideo ? VIDEO_MAX_FILE_SIZE_BYTES : MAX_FILE_SIZE_BYTES;
  const serverThreshold = isVideo ? VIDEO_SERVER_THRESHOLD_BYTES : SERVER_FALLBACK_THRESHOLD_BYTES;
  const maxLabel = isVideo ? '2GB' : '500MB';

  if (file.size > maxBytes) {
    throw new RedactionError(
      'FILE_TOO_LARGE',
      `File exceeds the ${maxLabel} limit. File size: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
      { maxMb: maxBytes / 1024 / 1024, actualMb: file.size / 1024 / 1024 }
    );
  }

  if (file.size > serverThreshold) {
    return FileProcessingPath.SERVER_SIDE;
  }

  return FileProcessingPath.CLIENT_SIDE;
}

export async function buildFileMetadata(file: File): Promise<FileMetadata> {
  const fileType = detectFileType(file);
  return {
    name: file.name,
    type: fileType,
    sizeBytes: file.size,
    addedAt: new Date().toISOString(),
  };
}

export async function readFileBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}
