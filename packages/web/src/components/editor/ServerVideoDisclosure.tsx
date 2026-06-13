import { AlertTriangle, Server } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  fileSizeMb: number;
  onAccept: () => void;
  onCancel: () => void;
}

export function ServerVideoDisclosure({ fileSizeMb, onAccept, onCancel }: Props) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm text-amber-900 dark:text-amber-200">
            Server-side processing required
          </p>
          <p className="text-sm text-amber-800/80 dark:text-amber-300/80 mt-1">
            Your video ({fileSizeMb.toFixed(0)} MB) exceeds the 100 MB client-side limit and will
            be processed on our secure servers.
          </p>
        </div>
      </div>

      <ul className="text-xs space-y-1.5 text-amber-800/70 dark:text-amber-300/70 pl-8">
        <li>• All data is transmitted over TLS 1.3</li>
        <li>
          • Your video and the redacted output are{' '}
          <strong>permanently deleted within 60 seconds of download</strong>
        </li>
        <li>• No content is stored, indexed, or used for any purpose beyond this request</li>
        <li>• Processing logs contain only job IDs — never file content</li>
      </ul>

      <div className="flex items-center gap-3 pl-8">
        <Button size="sm" onClick={onAccept} className="gap-1.5">
          <Server className="h-3.5 w-3.5" />
          I understand — process on server
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
