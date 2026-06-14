import { useEffect } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router';
import { RedactionEditor } from '@/components/editor/RedactionEditor';
import { useFileStore } from '@/stores/file.store';
import { useFileRouter } from '@/hooks/useFileRouter';

export function Editor() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { fileMetadata, setProcessingStatus } = useFileStore();
  const { processFile } = useFileRouter();

  const source = params.get('source');
  const fileUrl = params.get('url');
  const fileType = params.get('type');

  // Load file when arriving from the extension via URL params
  useEffect(() => {
    if (source === 'extension' && fileUrl) {
      fetch(fileUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const name = fileUrl.split('/').pop() ?? `file.${fileType ?? 'pdf'}`;
          const file = new File([blob], name, { type: blob.type });
          return processFile(file);
        })
        .catch(() => navigate('/'));
    }
  }, [source, fileUrl, fileType, processFile, navigate]);

  // Clear the loading spinner on the Home page once the editor is showing.
  // setFile() leaves processingStatus as 'loading' to prevent a flash on Home;
  // we reset it here after the editor has confirmed it has the file.
  useEffect(() => {
    if (fileMetadata) {
      setProcessingStatus('idle');
    }
  }, [fileMetadata, setProcessingStatus]);

  if (!fileMetadata && !fileUrl) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-6">
      <RedactionEditor />
    </div>
  );
}
