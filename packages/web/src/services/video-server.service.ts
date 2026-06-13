import type { VideoJobStatus, VideoRedactionConfig } from '@redact/shared';

const BASE = '/api/video';

export interface RequestUploadResult {
  uploadUrl: string;
  s3Key: string;
  jobId: string;
}

export interface JobStatusResult {
  jobId: string;
  status: VideoJobStatus;
  progress: number;
  errorMessage?: string;
}

export interface JobResultData {
  downloadUrl: string;
  outputS3Key: string;
  inputS3Key: string;
  jobId: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { data?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const json = (await res.json()) as { data?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.data as T;
}

export function requestUploadUrl(
  filename: string,
  contentType: string,
  sizeBytes: number,
): Promise<RequestUploadResult> {
  return post<RequestUploadResult>('/request-upload', { filename, contentType, sizeBytes });
}

export function uploadToS3(
  uploadUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`S3 upload failed: HTTP ${xhr.status}`));
    xhr.onerror = () => reject(new Error('S3 upload network error'));
    xhr.send(file);
  });
}

export function submitJob(
  jobId: string,
  s3Key: string,
  redactionConfig: VideoRedactionConfig,
): Promise<{ jobId: string }> {
  return post<{ jobId: string }>('/submit-job', { jobId, s3Key, redactionConfig });
}

export function pollJobStatus(jobId: string): Promise<JobStatusResult> {
  return get<JobStatusResult>(`/status?jobId=${encodeURIComponent(jobId)}`);
}

export function fetchJobResult(jobId: string): Promise<JobResultData> {
  return get<JobResultData>(`/result?jobId=${encodeURIComponent(jobId)}`);
}

export function cleanupJob(jobId: string, outputS3Key: string, inputS3Key: string): Promise<void> {
  return post<void>('/cleanup', { jobId, outputS3Key, inputS3Key });
}
