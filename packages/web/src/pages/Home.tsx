import { FileText, ImageIcon, Video, Monitor, ArrowRight, ShieldCheck, Zap, Lock, Upload, Cpu, Download } from 'lucide-react';
import { Link } from 'react-router';

const SERVICES = [
  {
    href: '/docs',
    label: 'Document Redaction',
    sub: 'PDF · DOCX · XLSX',
    desc: 'AI-powered PII detection for legal, HR, and financial documents. Names, emails, Aadhaar, PAN — reviewed before downloading.',
    icon: FileText,
    gradient: 'linear-gradient(135deg, #5B5EF4 0%, #7C3AED 100%)',
    glow: 'rgba(91,94,244,0.30)',
    formats: ['PDF', 'DOCX', 'XLSX'],
    tagBg: 'rgba(91,94,244,0.1)',
    tagColor: '#5B5EF4',
    hoverBorder: 'hover:border-primary/50',
    hoverShadow: 'hover:shadow-[0_12px_40px_rgba(91,94,244,0.18)]',
  },
  {
    href: '/image',
    label: 'Image Redaction',
    sub: 'JPG · PNG · WEBP',
    desc: 'Blur faces, mask vehicle plates, and redact sensitive regions in photos with pixel-precise canvas control.',
    icon: ImageIcon,
    gradient: 'linear-gradient(135deg, #F43F5E 0%, #EC4899 100%)',
    glow: 'rgba(244,63,94,0.28)',
    formats: ['JPG', 'PNG', 'WEBP', 'BMP'],
    tagBg: 'rgba(244,63,94,0.1)',
    tagColor: '#F43F5E',
    hoverBorder: 'hover:border-rose/50',
    hoverShadow: 'hover:shadow-[0_12px_40px_rgba(244,63,94,0.16)]',
  },
  {
    href: '/video',
    label: 'Video & Audio',
    sub: 'MP4 · MOV · WEBM',
    desc: 'Track and blur faces across frames, silence audio segments, and export redacted clips — entirely offline.',
    icon: Video,
    gradient: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)',
    glow: 'rgba(249,115,22,0.28)',
    formats: ['MP4', 'MOV', 'WEBM', 'AVI'],
    tagBg: 'rgba(249,115,22,0.1)',
    tagColor: '#F97316',
    hoverBorder: 'hover:border-orange/50',
    hoverShadow: 'hover:shadow-[0_12px_40px_rgba(249,115,22,0.15)]',
  },
  {
    href: '/screen-guard',
    label: 'Screen Guard',
    sub: 'Live Protection',
    desc: 'Burn private zones into screen recordings or blur your camera feed in real-time during video calls.',
    icon: Monitor,
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #10B981 100%)',
    glow: 'rgba(6,182,212,0.28)',
    formats: ['Screen', 'Camera'],
    tagBg: 'rgba(6,182,212,0.1)',
    tagColor: '#06B6D4',
    hoverBorder: 'hover:border-cyan/50',
    hoverShadow: 'hover:shadow-[0_12px_40px_rgba(6,182,212,0.15)]',
  },
] as const;

const STEPS = [
  {
    n: '01',
    icon: Upload,
    title: 'Drop your file',
    desc: 'Upload PDF, image, video or DOCX. Nothing leaves your device — ever.',
    color: '#5B5EF4',
    bg: 'rgba(91,94,244,0.1)',
  },
  {
    n: '02',
    icon: Cpu,
    title: 'AI detects PII',
    desc: 'Names, emails, Aadhaar, PAN, faces, vehicle numbers — found in seconds.',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.1)',
  },
  {
    n: '03',
    icon: Download,
    title: 'Review & download',
    desc: 'Approve findings, fine-tune, then export your clean redacted file instantly.',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.1)',
  },
];

const STATS = [
  { value: '100%', label: 'Client-side' },
  { value: '0',    label: 'Server uploads' },
  { value: '6+',   label: 'File formats' },
  { value: '∞',    label: 'Unlimited files' },
];

const TRUST = [
  {
    icon: Lock,
    title: 'Zero data transmission',
    desc: 'Runs in your browser with WebAssembly. Your files never touch a server — not even for a millisecond.',
    color: '#5B5EF4',
    bg: 'rgba(91,94,244,0.08)',
  },
  {
    icon: Zap,
    title: 'Instant results',
    desc: 'No server round-trips, no queue, no waiting. Redaction runs at full local CPU/GPU speed.',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
  },
  {
    icon: ShieldCheck,
    title: 'No account required',
    desc: 'Drop a file and start immediately. Your data stays on your device — always and forever.',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.08)',
  },
];

export function Home() {
  return (
    <div className="relative overflow-x-hidden">

      {/* ── Decorative background orbs (fixed so they stay behind scroll) ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div
          className="orb-1 absolute -top-48 -left-48 h-[600px] w-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(91,94,244,0.18) 0%, transparent 70%)', filter: 'blur(60px)' }}
        />
        <div
          className="orb-2 absolute -top-24 -right-24 h-[500px] w-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', filter: 'blur(60px)' }}
        />
        <div
          className="orb-3 absolute bottom-0 left-1/2 h-[500px] w-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }}
        />
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-28 pt-16 space-y-28">

        {/* ────────────── HERO ────────────── */}
        <section className="text-center space-y-8 max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
            style={{
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(91,94,244,0.25)',
              backdropFilter: 'blur(12px)',
              color: '#5B5EF4',
              boxShadow: '0 2px 12px rgba(91,94,244,0.12)',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
            100% client-side · files never leave your browser
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.06] text-foreground">
              Privacy redaction,
            </h1>
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.06] gradient-text">
              built for everyone
            </h1>
          </div>

          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Mask faces, block PII, redact documents — right in your browser.
            No uploads, no accounts, no cloud. Fully private, instant, and free.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/docs"
              className="inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #5B5EF4 0%, #7C3AED 100%)',
                boxShadow: '0 4px 24px rgba(91,94,244,0.4), 0 0 0 1px rgba(91,94,244,0.2)',
              }}
            >
              Start Redacting
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/image"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(226,225,240,0.9)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}
            >
              Try with an image
            </Link>
          </div>
        </section>

        {/* ────────────── STATS ────────────── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-6 text-center"
              style={{
                background: 'rgba(255,255,255,0.60)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
              }}
            >
              <p
                className="text-4xl font-black bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #5B5EF4, #7C3AED)' }}
              >
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 font-medium">{s.label}</p>
            </div>
          ))}
        </section>

        {/* ────────────── SERVICE CARDS ────────────── */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-foreground whitespace-nowrap">Choose your tool</h2>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, rgba(226,225,240,1), transparent)' }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SERVICES.map((s) => (
              <Link
                key={s.href}
                to={s.href}
                className={`group relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1.5 ${s.hoverBorder} ${s.hoverShadow}`}
                style={{
                  background: 'rgba(255,255,255,0.65)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.85)',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                }}
              >
                {/* Gradient banner */}
                <div
                  className="relative px-6 pt-6 pb-5 overflow-hidden"
                  style={{ background: s.gradient, boxShadow: `inset 0 -1px 0 rgba(0,0,0,0.1)` }}
                >
                  {/* Decorative circles */}
                  <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-110" />
                  <div className="pointer-events-none absolute right-4 top-4 h-14 w-14 rounded-full bg-white/10" />

                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
                        <s.icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-base leading-tight">{s.label}</p>
                        <p className="text-white/70 text-xs mt-0.5 font-medium">{s.sub}</p>
                      </div>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-all duration-200 group-hover:bg-white/25 group-hover:translate-x-0.5">
                      <ArrowRight className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div className="px-6 py-5 space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {s.formats.map((f) => (
                        <span
                          key={f}
                          className="rounded-lg px-2.5 py-0.5 text-[10px] font-bold tracking-wide"
                          style={{ background: s.tagBg, color: s.tagColor }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                      Open →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ────────────── HOW IT WORKS ────────────── */}
        <section className="space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-foreground">How it works</h2>
            <p className="text-muted-foreground text-sm">Three steps to a privacy-safe file</p>
          </div>

          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Connector line (desktop) */}
            <div
              className="hidden sm:block absolute top-11 left-[22%] right-[22%] h-px"
              style={{ background: 'linear-gradient(90deg, rgba(91,94,244,0.3), rgba(236,72,153,0.3), rgba(16,185,129,0.3))' }}
              aria-hidden="true"
            />

            {STEPS.map((step) => (
              <div
                key={step.n}
                className="relative rounded-2xl p-6 text-center"
                style={{
                  background: 'rgba(255,255,255,0.62)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.85)',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
                }}
              >
                <span
                  className="absolute top-3 right-4 text-[11px] font-black font-mono"
                  style={{ color: step.color, opacity: 0.5 }}
                >
                  {step.n}
                </span>
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: step.bg, border: `1px solid ${step.color}25` }}
                >
                  <step.icon className="h-6 w-6" style={{ color: step.color }} />
                </div>
                <p className="font-bold text-foreground text-sm mb-1.5">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ────────────── TRUST SIGNALS ────────────── */}
        <section
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.60)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.85)',
            boxShadow: '0 4px 32px rgba(0,0,0,0.06)',
          }}
        >
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {TRUST.map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="flex gap-4">
                <div
                  className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: bg, border: `1px solid ${color}20` }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">{title}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ────────────── FOOTER NOTE ────────────── */}
        <p className="text-center text-xs text-muted-foreground/70">
          Mask-R uses WebAssembly, Tesseract.js, and MediaPipe — all running locally in your browser.
          <br />Built for privacy. No telemetry. No tracking. No servers.
        </p>

      </div>
    </div>
  );
}
