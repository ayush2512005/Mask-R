import { create } from 'zustand';
import type { FileMetadata, SupportedFileType, ProcessingStatus } from '@redact/shared';

interface FileState {
  currentFile: File | null;
  fileBuffer: ArrayBuffer | null;
  fileMetadata: FileMetadata | null;
  fileType: SupportedFileType | null;
  processingStatus: ProcessingStatus;
  errorMessage: string | null;
  setFile: (file: File, metadata: FileMetadata, buffer: ArrayBuffer) => void;
  setProcessingStatus: (status: ProcessingStatus) => void;
  setError: (message: string) => void;
  clearFile: () => void;
}

export const useFileStore = create<FileState>((set) => ({
  currentFile: null,
  fileBuffer: null,
  fileMetadata: null,
  fileType: null,
  processingStatus: 'idle',
  errorMessage: null,

  setFile: (file, metadata, buffer) =>
    set({
      currentFile: file,
      fileBuffer: buffer,
      fileMetadata: metadata,
      fileType: metadata.type,
      processingStatus: 'idle',
      errorMessage: null,
    }),

  setProcessingStatus: (status) => set({ processingStatus: status }),

  setError: (errorMessage) => set({ processingStatus: 'error', errorMessage }),

  clearFile: () =>
    set({
      currentFile: null,
      fileBuffer: null,
      fileMetadata: null,
      fileType: null,
      processingStatus: 'idle',
      errorMessage: null,
    }),
}));
