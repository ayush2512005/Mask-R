import { useState } from 'react';
import { ScreenRecordingGuard } from '@/components/editor/ScreenRecordingGuard';
import { CameraBlurGuard } from '@/components/editor/CameraBlurGuard';

type Tab = 'screen' | 'camera';

export function ScreenGuard() {
  const [tab, setTab] = useState<Tab>('screen');

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit border">
        {(['screen', 'camera'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'screen' ? 'Screen Recording' : 'Camera Blur'}
          </button>
        ))}
      </div>

      {tab === 'screen' ? <ScreenRecordingGuard /> : <CameraBlurGuard />}
    </div>
  );
}
