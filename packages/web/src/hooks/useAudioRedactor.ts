import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type RedactionMode = 'silence' | 'bleep';

export interface AudioRange {
  id: string;
  startTime: number;
  endTime: number;
  mode: RedactionMode;
}

export interface TranscriptWord {
  id: string;
  word: string;
  startTime: number;
  endTime: number;
  redacted: boolean;
}

export interface UseAudioRedactorReturn {
  waveformData: Float32Array | null;
  waveformDuration: number;
  ranges: AudioRange[];
  transcript: TranscriptWord[];
  transcribing: boolean;
  hasSpeechRecognition: boolean;
  hasAudioRedaction: boolean;
  addRange: (startTime: number, endTime: number, mode?: RedactionMode) => void;
  removeRange: (id: string) => void;
  updateRangeMode: (id: string, mode: RedactionMode) => void;
  toggleWordRedaction: (id: string) => void;
  startTranscription: () => void;
  stopTranscription: () => void;
  getExportAudioStream: () => MediaStream | null;
  exportSrt: () => void;
}

export function useAudioRedactor(
  fileBuffer: ArrayBuffer | null,
  videoRef: { readonly current: HTMLVideoElement | null },
): UseAudioRedactorReturn {
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [waveformDuration, setWaveformDuration] = useState(0);
  const [ranges, setRanges] = useState<AudioRange[]>([]);
  const [transcript, setTranscript] = useState<TranscriptWord[]>([]);
  const [transcribing, setTranscribing] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const voiceGainRef = useRef<GainNode | null>(null);
  const bleepGainRef = useRef<GainNode | null>(null);
  const exportDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const lastEndTimeRef = useRef(0);

  const hasSpeechRecognition =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Reset and decode waveform whenever the source file changes
  useEffect(() => {
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
      voiceGainRef.current = null;
      bleepGainRef.current = null;
      exportDestRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setWaveformData(null);
    setWaveformDuration(0);
    setRanges([]);
    setTranscript([]);
    setTranscribing(false);
    lastEndTimeRef.current = 0;

    if (!fileBuffer) return;

    const tempCtx = new AudioContext();
    tempCtx
      .decodeAudioData(fileBuffer.slice(0))
      .then((ab) => {
        setWaveformData(ab.getChannelData(0));
        setWaveformDuration(ab.duration);
      })
      .catch(() => {
        // Not all video containers expose a decodable audio track
      })
      .finally(() => void tempCtx.close());
  }, [fileBuffer]);

  useEffect(() => {
    return () => {
      void audioCtxRef.current?.close();
      recognitionRef.current?.stop();
    };
  }, []);

  // Build the Web Audio export graph lazily (only when audio redaction is used)
  const initAudioGraph = useCallback(() => {
    const v = videoRef.current;
    if (!v || audioCtxRef.current) return;

    const ctx = new AudioContext();
    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(v);
    } catch {
      // Already connected to another context
      void ctx.close();
      return;
    }

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 1;

    // Persistent 1kHz oscillator for bleep mode (gain kept at 0 until needed)
    const bleepOsc = ctx.createOscillator();
    bleepOsc.type = 'sine';
    bleepOsc.frequency.value = 1000;
    bleepOsc.start();
    const bleepGain = ctx.createGain();
    bleepGain.gain.value = 0;

    const dest = ctx.createMediaStreamDestination();

    source.connect(voiceGain);
    voiceGain.connect(ctx.destination); // Normal playback
    voiceGain.connect(dest); // Export capture

    bleepOsc.connect(bleepGain);
    bleepGain.connect(ctx.destination);
    bleepGain.connect(dest);

    audioCtxRef.current = ctx;
    voiceGainRef.current = voiceGain;
    bleepGainRef.current = bleepGain;
    exportDestRef.current = dest;
  }, [videoRef]);

  const addRange = useCallback((startTime: number, endTime: number, mode: RedactionMode = 'silence') => {
    setRanges((prev) => [...prev, { id: uuidv4(), startTime, endTime, mode }]);
  }, []);

  const removeRange = useCallback((id: string) => {
    setRanges((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateRangeMode = useCallback((id: string, mode: RedactionMode) => {
    setRanges((prev) => prev.map((r) => (r.id === id ? { ...r, mode } : r)));
  }, []);

  const toggleWordRedaction = useCallback((wordId: string) => {
    setTranscript((prev) => {
      const updated = prev.map((w) => (w.id === wordId ? { ...w, redacted: !w.redacted } : w));
      const word = updated.find((w) => w.id === wordId);
      if (word) {
        if (word.redacted) {
          setRanges((r) => [...r, { id: uuidv4(), startTime: word.startTime, endTime: word.endTime, mode: 'silence' }]);
        } else {
          setRanges((r) => r.filter((rng) => Math.abs(rng.startTime - word.startTime) >= 0.05));
        }
      }
      return updated;
    });
  }, []);

  const startTranscription = useCallback(() => {
    const v = videoRef.current;
    if (!v || !hasSpeechRecognition) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    lastEndTimeRef.current = 0;
    setTranscript([]);
    setTranscribing(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = event.results[i];
        if (!result.isFinal) continue;

        const text = String(result[0]?.transcript ?? '').trim();
        const endTime = v.currentTime;
        const words: string[] = text.split(/\s+/).filter(Boolean) as string[];
        const segmentDuration = endTime - lastEndTimeRef.current;

        const newWords: TranscriptWord[] = words.map((word: string, idx: number) => ({
          id: uuidv4(),
          word,
          startTime: lastEndTimeRef.current + (segmentDuration * idx) / words.length,
          endTime: lastEndTimeRef.current + (segmentDuration * (idx + 1)) / words.length,
          redacted: false,
        }));

        if (newWords.length > 0) {
          setTranscript((prev) => [...prev, ...newWords]);
          lastEndTimeRef.current = endTime;
        }
      }
    };

    recognition.onend = () => {
      setTranscribing(false);
      v.pause();
    };

    recognitionRef.current = recognition;
    recognition.start();
    v.currentTime = 0;
    void v.play();
  }, [videoRef, hasSpeechRecognition]);

  const stopTranscription = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setTranscribing(false);
    videoRef.current?.pause();
  }, [videoRef]);

  // Returns a MediaStream with gain-scheduled redaction applied to the video's audio.
  // Call immediately before starting MediaRecorder so timing aligns with video.currentTime = 0.
  const getExportAudioStream = useCallback((): MediaStream | null => {
    if (ranges.length === 0) return null;

    initAudioGraph();

    const ctx = audioCtxRef.current;
    const voiceGain = voiceGainRef.current;
    const bleepGain = bleepGainRef.current;
    const dest = exportDestRef.current;
    if (!ctx || !voiceGain || !bleepGain || !dest) return null;

    void ctx.resume();

    // Reschedule gain automations aligned to video time = 0 starting now
    const now = ctx.currentTime;
    voiceGain.gain.cancelScheduledValues(now);
    voiceGain.gain.setValueAtTime(1, now);
    bleepGain.gain.cancelScheduledValues(now);
    bleepGain.gain.setValueAtTime(0, now);

    for (const range of ranges) {
      voiceGain.gain.setValueAtTime(0, now + range.startTime);
      voiceGain.gain.setValueAtTime(1, now + range.endTime);
      if (range.mode === 'bleep') {
        bleepGain.gain.setValueAtTime(0.25, now + range.startTime);
        bleepGain.gain.setValueAtTime(0, now + range.endTime);
      }
    }

    return dest.stream;
  }, [ranges, initAudioGraph]);

  const exportSrt = useCallback(() => {
    function toSrtTime(s: number): string {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      const ms = Math.round((s % 1) * 1000);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    }

    let srt = '';
    let idx = 1;

    if (transcript.length > 0) {
      let lineStart = transcript[0]?.startTime ?? 0;
      let lineEnd = 0;
      let lineWords: string[] = [];

      for (let wi = 0; wi < transcript.length; wi++) {
        const w = transcript[wi]!;
        lineWords.push(w.redacted ? '[REDACTED]' : w.word);
        lineEnd = w.endTime;

        const isLast = wi === transcript.length - 1;
        if (lineWords.length >= 8 || isLast) {
          srt += `${idx}\n${toSrtTime(lineStart)} --> ${toSrtTime(lineEnd)}\n${lineWords.join(' ')}\n\n`;
          idx++;
          lineStart = transcript[wi + 1]?.startTime ?? lineEnd;
          lineWords = [];
        }
      }
    } else {
      for (const range of ranges) {
        srt += `${idx}\n${toSrtTime(range.startTime)} --> ${toSrtTime(range.endTime)}\n[REDACTED]\n\n`;
        idx++;
      }
    }

    const blob = new Blob([srt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript.srt';
    a.click();
    URL.revokeObjectURL(url);
  }, [transcript, ranges]);

  return {
    waveformData,
    waveformDuration,
    ranges,
    transcript,
    transcribing,
    hasSpeechRecognition,
    hasAudioRedaction: ranges.length > 0,
    addRange,
    removeRange,
    updateRangeMode,
    toggleWordRedaction,
    startTranscription,
    stopTranscription,
    getExportAudioStream,
    exportSrt,
  };
}
