import { useCallback, useRef, useState } from 'react';
import type { VideoRedactionConfig } from '@redact/shared';
import {
  requestUploadUrl,
  uploadToS3,
  submitJob,
  pollJobStatus,
  fetchJobResult,
  cleanupJob,
  type JobResultData,
} from '@/services/video-server.service';

export type ServerPhase = 'idle' | 'uploading' | 'processing' | 'ready' | 'failed';

export interface UseServerVideoProcessorReturn {
  phase: ServerPhase;
  uploadProgress: number;
  jobProgress: number;
  error: string | null;
  proceed: (file: File, config: VideoRedactionConfig) => Promise<void>;
  downloadAndCleanup: () => Promise<ArrayBuffer>;
  reset: () => void;
}

const POLL_MS = 4000;

export function useServerVideoProcessor(): UseServerVideoProcessorReturn {
  const [phase, setPhase] = useState<ServerPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const resultRef = useRef<JobResultData | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const proceed = useCallback(
    async (file: File, config: VideoRedactionConfig) => {
      try {
        setPhase('uploading');
        setUploadProgress(0);
        setJobProgress(0);
        setError(null);
        resultRef.current = null;

        const { uploadUrl, s3Key, jobId } = await requestUploadUrl(file.name, file.type, file.size);
        await uploadToS3(uploadUrl, file, setUploadProgress);

        setPhase('processing');
        await submitJob(jobId, s3Key, config);

        await new Promise<void>((resolve, reject) => {
          pollRef.current = setInterval(async () => {
            try {
              const status = await pollJobStatus(jobId);
              setJobProgress(status.progress);

              if (status.status === 'complete') {
                stopPolling();
                resultRef.current = await fetchJobResult(jobId);
                setPhase('ready');
                resolve();
              } else if (status.status === 'failed') {
                stopPolling();
                reject(new Error(status.errorMessage ?? 'Server processing failed'));
              }
            } catch (err) {
              stopPolling();
              reject(err);
            }
          }, POLL_MS);
        });
      } catch (err) {
        stopPolling();
        setError(err instanceof Error ? err.message : 'Server processing failed');
        setPhase('failed');
      }
    },
    [stopPolling],
  );

  const downloadAndCleanup = useCallback(async (): Promise<ArrayBuffer> => {
    const result = resultRef.current;
    if (!result) throw new Error('No result available');

    const res = await fetch(result.downloadUrl);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();

    // NFR-5: fire-and-forget deletion within 60 seconds of delivery
    cleanupJob(result.jobId, result.outputS3Key, result.inputS3Key).catch((err) =>
      console.warn('[ServerVideo] Cleanup failed:', err),
    );

    return buffer;
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    resultRef.current = null;
    setPhase('idle');
    setUploadProgress(0);
    setJobProgress(0);
    setError(null);
  }, [stopPolling]);

  return { phase, uploadProgress, jobProgress, error, proceed, downloadAndCleanup, reset };
}
