import { Shield, FileText, Image, Zap, Lock } from 'lucide-react';
import { DropZone } from '@/components/upload/DropZone';
import { useFileStore } from '@/stores/file.store';
import { useSessionStore } from '@/stores/session.store';
import { UserTier } from '@redact/shared';
import { FREE_TIER_SESSION_LIMIT } from '@/lib/constants';
import { Link } from 'react-router';

const FEATURES = [
  { icon: Shield, title: 'AI PII Detection', desc: 'Auto-detects names, emails, phones, addresses, and card numbers.' },
  { icon: FileText, title: 'PDF & Word', desc: 'Redact text from PDFs and Word documents with formatting preserved.' },
  { icon: Image, title: 'Image Masking', desc: 'Draw regions on images to mask sensitive visual content.' },
  { icon: Zap, title: 'Client-side', desc: 'All processing happens in your browser — files never leave your device.' },
  { icon: Lock, title: 'Private by design', desc: 'Zero server transmission. No account required to start.' },
];

export function Home() {
  const { processingStatus, errorMessage } = useFileStore();
  const { filesThisSession, tier } = useSessionStore();
  const remaining = tier === UserTier.FREE ? FREE_TIER_SESSION_LIMIT - filesThisSession : null;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="text-center mb-10 space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Redact sensitive data instantly</h1>
        <p className="text-lg text-muted-foreground">
          Upload a PDF, Word doc, or image. AI detects PII. You approve and download.
          <br />
          <span className="text-sm font-medium text-foreground">100% client-side — your files never leave your browser.</span>
        </p>
        {remaining !== null && (
          <p className="text-sm text-muted-foreground">
            {remaining} free file{remaining !== 1 ? 's' : ''} remaining this session ·{' '}
            <Link to="/pricing" className="text-primary hover:underline">Upgrade for unlimited</Link>
          </p>
        )}
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {processingStatus === 'loading' ? (
        <div className="flex items-center justify-center h-48 rounded-xl border-2 border-dashed border-border">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm">Loading file…</p>
          </div>
        </div>
      ) : (
        <DropZone />
      )}

      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex gap-3 rounded-lg border p-4">
            <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
