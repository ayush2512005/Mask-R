import { Video } from 'lucide-react';
import { ServicePage } from '@/components/upload/ServicePage';

const VIDEO_MIMES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/avi',
].join(',');

export function VideoRedactPage() {
  return (
    <ServicePage
      tagline="Video & Audio Redaction"
      title="Blur Faces, Silence Audio"
      description="Upload a video clip. Auto-detect and track faces across every frame, draw manual redaction regions on the timeline, and silence or bleep specific audio segments before exporting the redacted file."
      gradient="linear-gradient(135deg, #F97316 0%, #EF4444 100%)"
      glowColor="rgba(249, 115, 22, 0.25)"
      icon={Video}
      accept={VIDEO_MIMES}
      formatLabels={['MP4', 'MOV', 'WEBM', 'AVI']}
      features={[
        'Real-time face tracking across frames',
        'Per-face blur, pixelate or emoji',
        'Partial mask — eyes or mouth only',
        'AI face swap (synthetic replacement)',
        'Crowd blur — protect background faces',
        'Timeline audio waveform editor',
        'Silence or bleep audio segments',
        'SRT transcript export',
      ]}
      accentClass="border-orange/50 bg-orange/5"
      iconColorClass="text-orange"
    />
  );
}
