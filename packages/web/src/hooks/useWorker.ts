import { useCallback, useEffect, useRef, useState } from 'react';

export type WorkerMessage<TConfig> =
  | { type: 'PROCESS'; payload: TConfig }
  | { type: 'CANCEL' };

export type WorkerResponse<TResult> =
  | { type: 'PROGRESS'; payload: { pct: number; stage: string } }
  | { type: 'COMPLETE'; payload: TResult }
  | { type: 'ERROR'; payload: { code: string; message: string } };

interface WorkerState<TResult> {
  progress: number;
  stage: string;
  result: TResult | null;
  error: { code: string; message: string } | null;
  status: 'idle' | 'running' | 'complete' | 'error';
}

interface UseWorkerReturn<TConfig, TResult> extends WorkerState<TResult> {
  run: (config: TConfig) => void;
  cancel: () => void;
}

export function useWorker<TConfig, TResult>(
  createWorker: () => Worker
): UseWorkerReturn<TConfig, TResult> {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<WorkerState<TResult>>({
    progress: 0,
    stage: '',
    result: null,
    error: null,
    status: 'idle',
  });

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const run = useCallback(
    (config: TConfig) => {
      workerRef.current?.terminate();
      const worker = createWorker();
      workerRef.current = worker;

      setState({ progress: 0, stage: '', result: null, error: null, status: 'running' });

      worker.onmessage = ({ data }: MessageEvent<WorkerResponse<TResult>>) => {
        if (data.type === 'PROGRESS') {
          setState((s) => ({ ...s, progress: data.payload.pct, stage: data.payload.stage }));
        } else if (data.type === 'COMPLETE') {
          setState({ progress: 100, stage: 'done', result: data.payload, error: null, status: 'complete' });
          worker.terminate();
          workerRef.current = null;
        } else if (data.type === 'ERROR') {
          setState((s) => ({ ...s, error: data.payload, status: 'error' }));
          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = (e) => {
        setState((s) => ({
          ...s,
          error: { code: 'WORKER_ERROR', message: e.message ?? 'Unknown worker error' },
          status: 'error',
        }));
        worker.terminate();
        workerRef.current = null;
      };

      const msg: WorkerMessage<TConfig> = { type: 'PROCESS', payload: config };
      worker.postMessage(msg);
    },
    [createWorker]
  );

  const cancel = useCallback(() => {
    if (workerRef.current) {
      const msg: WorkerMessage<TConfig> = { type: 'CANCEL' } as WorkerMessage<TConfig>;
      workerRef.current.postMessage(msg);
      workerRef.current.terminate();
      workerRef.current = null;
      setState((s) => ({ ...s, status: 'idle' }));
    }
  }, []);

  return { ...state, run, cancel };
}
