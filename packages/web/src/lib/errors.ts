import type { ApiErrorCode } from '@redact/shared';

export class RedactionError extends Error {
  constructor(
    public readonly code: ApiErrorCode | string,
    message: string,
    public readonly context?: unknown
  ) {
    super(message);
    this.name = 'RedactionError';
  }
}

export class WorkerError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}
