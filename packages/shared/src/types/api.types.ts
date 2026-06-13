export interface ApiSuccess<T> {
  data: T;
  meta?: {
    requestId: string;
    processedAt: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type ApiErrorCode =
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'AUTH_REQUIRED'
  | 'PLAN_REQUIRED'
  | 'PROCESSING_FAILED'
  | 'NOT_FOUND';

export type VideoJobStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface VideoRedactionConfig {
  videoDimensions: { width: number; height: number };
  maskingStyle: string;
  timedRegions: Array<{
    startTime: number;
    endTime: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  faceRegions: Array<{
    faceId: string;
    startTime: number;
    endTime: number;
    style: string;
    partialMode: string;
    trajectory: Array<{ time: number; bbox: { x: number; y: number; width: number; height: number } }>;
  }>;
  audioRanges: Array<{
    startTime: number;
    endTime: number;
    mode: 'silence' | 'bleep';
  }>;
}
