import { FileText } from 'lucide-react';
import { ServicePage } from '@/components/upload/ServicePage';

const DOC_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

export function DocsRedactPage() {
  return (
    <ServicePage
      tagline="Document Redaction"
      title="Remove PII from Documents"
      description="Upload a PDF, Word doc, or Excel file. Our AI scans every word for names, emails, phone numbers, addresses, and financial data — you review each finding and approve before downloading the clean file."
      gradient="linear-gradient(135deg, #5B5EF4 0%, #7C3AED 100%)"
      glowColor="rgba(91, 94, 244, 0.28)"
      icon={FileText}
      accept={DOC_MIMES}
      formatLabels={['PDF', 'DOCX', 'XLSX']}
      features={[
        'AI-powered PII detection',
        'Names, emails & phone numbers',
        'Addresses & postcodes',
        'Financial data & card numbers',
        'Confidence scoring per finding',
        'Review before redacting',
        'Formatting preserved on export',
        '100% runs in your browser',
      ]}
      accentClass="border-primary/50 bg-primary/5"
      iconColorClass="text-primary"
    />
  );
}
