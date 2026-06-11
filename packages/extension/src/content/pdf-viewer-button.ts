import type { ExtensionMessage } from '../shared/messaging';

function isPdfViewer(): boolean {
  return (
    document.querySelector('embed[type="application/pdf"]') !== null ||
    /\.pdf(\?.*)?$/i.test(window.location.href) ||
    document.contentType === 'application/pdf'
  );
}

function injectButton() {
  if (!isPdfViewer()) return;
  if (document.getElementById('redact-pdf-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'redact-pdf-btn';
  btn.textContent = '🔒 Redact';
  btn.style.cssText = `
    position: fixed; top: 8px; right: 120px; z-index: 9999;
    background: #3b82f6; color: white; border: none;
    padding: 6px 12px; border-radius: 6px; font-size: 13px;
    cursor: pointer; font-family: system-ui, sans-serif;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  `;

  btn.addEventListener('click', () => {
    const msg: ExtensionMessage = { type: 'OPEN_PDF_VIEWER', pdfUrl: window.location.href };
    chrome.runtime.sendMessage(msg);
  });

  document.body.appendChild(btn);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectButton);
} else {
  injectButton();
}
