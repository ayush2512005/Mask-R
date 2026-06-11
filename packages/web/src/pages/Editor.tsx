import { useEffect } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router';
import { RedactionEditor } from '@/components/editor/RedactionEditor';
import { useFileStore } from '@/stores/file.store';
import { useFileRouter } from '@/hooks/useFileRouter';

export function Editor() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { fileMetadata } = useFileStore();
  const { processFile } = useFileRouter();

  const source = params.get('source');
  const fileUrl = params.get('url');
  const fileType = params.get('type');

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

  if (!fileMetadata && !fileUrl) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <RedactionEditor />
    </div>
  );
}
