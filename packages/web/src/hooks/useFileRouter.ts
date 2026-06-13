import { useCallback } from 'react';
import { FileProcessingPath } from '@redact/shared';
import { useFileStore } from '../stores/file.store';
import { useSessionStore } from '../stores/session.store';
import {
  buildFileMetadata,
  readFileBuffer,
  routeFile,
} from '../services/file-router.service';

export interface FileRouterResult {
  path: FileProcessingPath;
}

export function useFileRouter() {
  const { setFile, setError, setProcessingStatus } = useFileStore();
  const { canProcessFile, incrementFileCount } = useSessionStore();

  const processFile = useCallback(
    async (file: File): Promise<FileRouterResult | null> => {
      if (!canProcessFile()) {
        return null;
      }

      setProcessingStatus('loading');

      try {
        const metadata = await buildFileMetadata(file);
        const path = routeFile(file);
        const buffer = await readFileBuffer(file);

        setFile(file, metadata, buffer);
        incrementFileCount();

        return { path };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process file';
        setError(message);
        return null;
      }
    },
    [canProcessFile, incrementFileCount, setFile, setError, setProcessingStatus]
  );

  return { processFile };
}
