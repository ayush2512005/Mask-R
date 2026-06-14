import type { LucideIcon } from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';
import { DropZone } from './DropZone';
import { useFileStore } from '@/stores/file.store';

interface ServicePageProps {
  title: string;
  tagline: string;
  description: string;
  gradient: string;
  glowColor: string;
  icon: LucideIcon;
  accept: string;
  formatLabels: string[];
  features: string[];
  accentClass: string;
  iconColorClass: string;
  featureColor?: string;
}

export function ServicePage({
  title,
  tagline,
  description,
  gradient,
  glowColor,
  icon: Icon,
  accept,
  formatLabels,
  features,
  accentClass,
  iconColorClass,
  featureColor = '#5B5EF4',
}: ServicePageProps) {
  const { processingStatus } = useFileStore();

  return (
    <div className="relative mx-auto max-w-2xl px-6 pb-20 pt-10 space-y-6">

      {/* ── Hero banner card ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-8 text-white"
        style={{
          background: gradient,
          boxShadow: `0 16px 48px ${glowColor}, 0 0 0 1px rgba(255,255,255,0.1) inset`,
        }}
      >
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-sm" />
        <div className="pointer-events-none absolute right-4 top-4 h-20 w-20 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-8 left-8 h-32 w-32 rounded-full bg-black/10" />

        <div className="relative flex items-start gap-5">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            <Icon className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-75 mb-1">{tagline}</p>
            <h1 className="text-2xl font-black tracking-tight mb-2">{title}</h1>
            <p className="text-sm opacity-85 leading-relaxed max-w-md">{description}</p>
          </div>
        </div>

        {/* Format pills */}
        <div className="relative mt-6 flex flex-wrap gap-2">
          {formatLabels.map((fmt) => (
            <span
              key={fmt}
              className="rounded-full px-3 py-0.5 text-[11px] font-bold tracking-wide"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', backdropFilter: 'blur(4px)' }}
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {/* ── Features grid ── */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'rgba(255,255,255,0.60)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
        }}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">What's included</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {features.map((feat) => (
            <div key={feat} className="flex items-center gap-2.5 text-sm text-foreground/80">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: featureColor }} />
              {feat}
            </div>
          ))}
        </div>
      </div>

      {/* ── Upload zone ── */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.80)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}
      >
        {processingStatus === 'loading' ? (
          <div className="flex h-52 items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div
                className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: `${featureColor}40`, borderTopColor: 'transparent' }}
              />
              <p className="text-sm font-medium">Processing file…</p>
            </div>
          </div>
        ) : (
          <DropZone
            accept={accept}
            hint={formatLabels.join(' · ')}
            accentClass={accentClass}
            iconColorClass={iconColorClass}
          />
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground/60">
        All processing happens locally in your browser — your files are never uploaded to any server.
      </p>
    </div>
  );
}
