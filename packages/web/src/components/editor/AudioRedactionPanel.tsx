import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Mic, MicOff, FileDown, Trash2 } from 'lucide-react';
import type { UseAudioRedactorReturn } from '@/hooks/useAudioRedactor';

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return `${String(m).padStart(2, '0')}:${sec}`;
}

function parseTime(s: string): number {
  const parts = s.split(':');
  if (parts.length === 2) return parseFloat(parts[0] ?? '0') * 60 + parseFloat(parts[1] ?? '0');
  return parseFloat(s) || 0;
}

interface Props {
  audioRedactor: UseAudioRedactorReturn;
  currentTime: number;
  duration: number;
}

export function AudioRedactionPanel({ audioRedactor, currentTime, duration }: Props) {
  const {
    waveformData,
    waveformDuration,
    ranges,
    transcript,
    transcribing,
    hasSpeechRecognition,
    hasAudioRedaction,
    addRange,
    removeRange,
    updateRangeMode,
    toggleWordRedaction,
    startTranscription,
    stopTranscription,
    exportSrt,
  } = audioRedactor;

  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');

  const refDuration = waveformDuration || duration;

  const drawWaveform = useCallback(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    if (waveformData && W > 0) {
      const step = Math.max(1, Math.ceil(waveformData.length / W));
      const amp = H / 2;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < W; i++) {
        let min = 0;
        let max = 0;
        for (let j = i * step; j < Math.min((i + 1) * step, waveformData.length); j++) {
          const v = waveformData[j] ?? 0;
          if (v < min) min = v;
          if (v > max) max = v;
        }
        ctx.moveTo(i, amp + min * amp * 0.9);
        ctx.lineTo(i, amp + max * amp * 0.9);
      }
      ctx.stroke();
    } else if (!waveformData) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, H / 2 - 1, W, 2);
    }

    // Range overlays
    if (refDuration > 0) {
      for (const range of ranges) {
        const x1 = (range.startTime / refDuration) * W;
        const x2 = (range.endTime / refDuration) * W;
        ctx.fillStyle = range.mode === 'bleep' ? 'rgba(251,146,60,0.35)' : 'rgba(239,68,68,0.35)';
        ctx.fillRect(x1, 0, x2 - x1, H);
        ctx.strokeStyle = range.mode === 'bleep' ? 'rgba(251,146,60,0.9)' : 'rgba(239,68,68,0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x1, 0, x2 - x1, H);
      }

      // In-progress selection
      if (isDragging && dragStart !== null && dragEnd !== null) {
        const x1 = (Math.min(dragStart, dragEnd) / refDuration) * W;
        const x2 = (Math.max(dragStart, dragEnd) / refDuration) * W;
        ctx.fillStyle = 'rgba(59,130,246,0.3)';
        ctx.fillRect(x1, 0, x2 - x1, H);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.strokeRect(x1, 0, x2 - x1, H);
      }

      // Playhead
      const px = (currentTime / refDuration) * W;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
    }
  }, [waveformData, ranges, isDragging, dragStart, dragEnd, currentTime, refDuration]);

  useEffect(() => { drawWaveform(); }, [drawWaveform]);

  function canvasTime(e: React.MouseEvent<HTMLCanvasElement>): number {
    const canvas = waveCanvasRef.current!;
    const x = Math.max(0, Math.min(e.clientX - canvas.getBoundingClientRect().left, canvas.width));
    return (x / canvas.width) * refDuration;
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (refDuration === 0) return;
    setDragStart(canvasTime(e));
    setDragEnd(canvasTime(e));
    setIsDragging(true);
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDragging) return;
    setDragEnd(canvasTime(e));
  }

  function onMouseUp() {
    if (isDragging && dragStart !== null && dragEnd !== null) {
      const start = Math.min(dragStart, dragEnd);
      const end = Math.max(dragStart, dragEnd);
      if (end - start >= 0.1) addRange(start, end);
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }

  function addManualRange() {
    const start = parseTime(manualStart);
    const end = parseTime(manualEnd);
    if (end > start && end <= refDuration) {
      addRange(start, end);
      setManualStart('');
      setManualEnd('');
    }
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audio Redaction</p>

      {/* Waveform canvas */}
      <div className="space-y-1">
        <canvas
          ref={waveCanvasRef}
          width={600}
          height={56}
          className="w-full rounded border border-border cursor-crosshair"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          title={refDuration === 0 ? 'Waveform loading…' : 'Click-drag to select a region to redact'}
        />
        {!waveformData && (
          <p className="text-[10px] text-muted-foreground">
            {refDuration === 0 ? 'Loading waveform…' : 'Waveform unavailable — use manual time entry below'}
          </p>
        )}
      </div>

      {/* Manual time entry */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={manualStart}
          onChange={(e) => setManualStart(e.target.value)}
          placeholder="MM:SS"
          className="border rounded px-2 py-1 text-xs w-20 font-mono"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <input
          value={manualEnd}
          onChange={(e) => setManualEnd(e.target.value)}
          placeholder="MM:SS"
          className="border rounded px-2 py-1 text-xs w-20 font-mono"
        />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addManualRange}>
          Silence
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
          const start = parseTime(manualStart);
          const end = parseTime(manualEnd);
          if (end > start) { addRange(start, end, 'bleep'); setManualStart(''); setManualEnd(''); }
        }}>
          Bleep
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto">{fmtTime(currentTime)}</span>
      </div>

      {/* Range list */}
      {ranges.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <div className="bg-muted/40 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {ranges.length} audio region{ranges.length !== 1 ? 's' : ''}
          </div>
          <ul className="divide-y">
            {ranges.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-1.5 bg-card">
                <span className="text-xs font-mono flex-1 tabular-nums">
                  {fmtTime(r.startTime)} → {fmtTime(r.endTime)}
                </span>
                <div className="flex gap-0.5">
                  {(['silence', 'bleep'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateRangeMode(r.id, m)}
                      className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${
                        r.mode === m
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-muted'
                      }`}
                    >
                      {m === 'silence' ? '—' : '🔊'}
                    </button>
                  ))}
                </div>
                <button onClick={() => removeRange(r.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transcript (Speech Recognition) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Auto Transcript
          </p>
          <div className="flex gap-1.5">
            {!transcribing ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={startTranscription}
                disabled={!hasSpeechRecognition}
                title={hasSpeechRecognition ? 'Play video + transcribe (speakers must be on)' : 'Requires Chrome'}
              >
                <Mic className="h-3 w-3" /> Transcribe
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={stopTranscription}>
                <MicOff className="h-3 w-3" /> Stop
              </Button>
            )}
            {hasAudioRedaction && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportSrt}>
                <FileDown className="h-3 w-3" /> SRT
              </Button>
            )}
          </div>
        </div>

        {!hasSpeechRecognition && (
          <p className="text-[10px] text-muted-foreground">Auto-transcript requires Chrome.</p>
        )}

        {hasSpeechRecognition && transcript.length === 0 && !transcribing && (
          <p className="text-[10px] text-muted-foreground">
            Click Transcribe — the video will play back and speech will be recognized via your speakers + microphone.
            Click words to mark them for redaction.
          </p>
        )}

        {transcript.length > 0 && (
          <div className="max-h-28 overflow-y-auto rounded border p-2 bg-muted/20 text-xs leading-relaxed">
            {transcript.map((w) => (
              <button
                key={w.id}
                onClick={() => toggleWordRedaction(w.id)}
                title={`${fmtTime(w.startTime)} → ${fmtTime(w.endTime)}`}
                className={`mr-1 mb-0.5 px-0.5 rounded transition-colors ${
                  w.redacted
                    ? 'bg-destructive/80 text-destructive-foreground line-through'
                    : 'hover:bg-muted'
                }`}
              >
                {w.word}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
