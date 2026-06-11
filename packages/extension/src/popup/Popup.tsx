import { useState, useEffect } from 'react';
import { WEB_APP_BASE, getSuppressedSites, removeSuppressedSite } from '../shared/messaging';

export function Popup() {
  const [suppressed, setSuppressed] = useState<string[]>([]);

  useEffect(() => {
    getSuppressedSites().then(setSuppressed).catch(() => setSuppressed([]));
  }, []);

  async function handleRemove(site: string) {
    await removeSuppressedSite(site);
    setSuppressed((prev) => prev.filter((s) => s !== site));
  }

  return (
    <div style={{ width: 300, padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🔒</span>
        <strong style={{ fontSize: 14 }}>Redact</strong>
      </div>

      <a
        href={`${WEB_APP_BASE}/`}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'block',
          background: '#3b82f6',
          color: 'white',
          padding: '8px 12px',
          borderRadius: 8,
          textDecoration: 'none',
          textAlign: 'center',
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        Open Redact Tool
      </a>

      {suppressed.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
            Suppressed sites (click to re-enable):
          </p>
          {suppressed.map((site) => (
            <button
              key={site}
              onClick={() => handleRemove(site)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: '#f1f5f9',
                border: 'none',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                marginBottom: 4,
              }}
            >
              {site} ✕
            </button>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
        Right-click any PDF, DOCX, image link, or inline image to redact it.
      </p>
    </div>
  );
}
