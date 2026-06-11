import type { WorkerMessage, WorkerResponse } from '../hooks/useWorker';

export interface TimedRegion {
  id: string;
  startTime: number;
  endTime: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  mimeType: string;
}

export interface VideoProcessConfig {
  buffer: ArrayBuffer;
  mimeType: string;
  action: 'extract-metadata';
}

export interface VideoProcessResult {
  metadata?: VideoMetadata;
}

type InMessage = WorkerMessage<VideoProcessConfig>;
type OutMessage = WorkerResponse<VideoProcessResult>;

const post = (msg: OutMessage) => self.postMessage(msg);

async function extractMetadata(buffer: ArrayBuffer, mimeType: string): Promise<VideoMetadata> {
  post({ type: 'PROGRESS', payload: { pct: 10, stage: 'Reading video…' } });

  // Use WebCodecs VideoDecoder to get the first decoded frame dimensions
  // Fall back to creating a Blob URL and reading via HTMLVideoElement via OffscreenCanvas trick
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    // In workers we can use VideoDecoder if the browser supports it
    if (typeof VideoDecoder !== 'undefined') {
      return await extractViaWebCodecs(buffer, mimeType, url);
    }
    return await extractViaDurationHeuristic(buffer, mimeType);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function extractViaWebCodecs(
  _buffer: ArrayBuffer,
  mimeType: string,
  _url: string,
): Promise<VideoMetadata> {
  // WebCodecs gives us dimensions from the first decoded VideoFrame
  return new Promise<VideoMetadata>((resolve, reject) => {
    let resolved = false;

    const decoder = new VideoDecoder({
      output(frame) {
        if (!resolved) {
          resolved = true;
          resolve({
            duration: 0, // WebCodecs alone can't give duration without demuxing
            width: frame.displayWidth,
            height: frame.displayHeight,
            mimeType,
          });
          frame.close();
          decoder.close();
        }
      },
      error(e) {
        if (!resolved) {
          resolved = true;
          reject(e);
        }
      },
    });

    // If we can't decode we fall through; reject after timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('WebCodecs decode timeout'));
      }
    }, 5000);

    // Try common codec configs — browser will throw if unsupported
    const configs: VideoDecoderConfig[] = [
      { codec: 'avc1.42001E' },
      { codec: 'vp8' },
      { codec: 'vp09.00.10.08' },
    ];

    (async () => {
      for (const config of configs) {
        const support = await VideoDecoder.isConfigSupported(config);
        if (support.supported) {
          decoder.configure(config);
          break;
        }
      }
    })().catch(() => {});
  }).catch(() => extractViaDurationHeuristic(new ArrayBuffer(0), mimeType));
}

function extractViaDurationHeuristic(_buffer: ArrayBuffer, mimeType: string): VideoMetadata {
  // Fallback when WebCodecs is unavailable — return placeholder dimensions
  // The main thread VideoEditor will read real metadata from the <video> element
  return { duration: 0, width: 1920, height: 1080, mimeType };
}

self.onmessage = async ({ data }: MessageEvent<InMessage>) => {
  if (data.type === 'CANCEL') return;

  const { buffer, mimeType, action } = data.payload;

  try {
    if (action === 'extract-metadata') {
      const metadata = await extractMetadata(buffer, mimeType);
      post({ type: 'PROGRESS', payload: { pct: 100, stage: 'Done' } });
      post({ type: 'COMPLETE', payload: { metadata } });
    }
  } catch (err) {
    post({
      type: 'ERROR',
      payload: {
        code: 'VIDEO_PROCESSING_FAILED',
        message: err instanceof Error ? err.message : 'Video processing failed',
      },
    });
  }
};
