import { ImageIcon } from 'lucide-react';
import { ServicePage } from '@/components/upload/ServicePage';

const IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/bmp',
].join(',');

export function ImageRedactPage() {
  return (
    <ServicePage
      tagline="Image Redaction"
      title="Mask Faces & Sensitive Regions"
      description="Upload a photo, screenshot, or scanned document. Draw redaction zones with pixel-precise control, apply face detection, and blur or block any region before exporting."
      gradient="linear-gradient(135deg, #F43F5E 0%, #EC4899 100%)"
      glowColor="rgba(244, 63, 94, 0.25)"
      icon={ImageIcon}
      accept={IMAGE_MIMES}
      formatLabels={['JPG', 'PNG', 'WEBP', 'TIFF', 'BMP']}
      features={[
        'Auto face detection (MediaPipe)',
        'Manual draw-to-redact zones',
        'Blur, pixelate or black box',
        'License plate & text regions',
        'High-resolution output',
        'Lossless PNG export option',
        'Batch face approval workflow',
        '100% runs in your browser',
      ]}
      accentClass="border-rose/50 bg-rose/5"
      iconColorClass="text-rose"
    />
  );
}
