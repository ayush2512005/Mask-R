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
