import { buildEditorUrl, getFileTypeFromUrl, addSuppressedSite, getSuppressedSites, ExtensionMessage } from '../shared/messaging';

function showPrompt(url: string, fileType: string, downloadId?: number) {
  if (document.getElementById('redact-prompt-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'redact-prompt-overlay';
  overlay.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
    background: white; border: 1px solid #e2e8f0; border-radius: 12px;
    padding: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.14);
    font-family: system-ui, -apple-system, sans-serif; max-width: 320px;
    animation: redact-slide-in 0.2s ease;
  `;

  // Keyframe injection (idempotent)
  if (!document.getElementById('redact-prompt-styles')) {
    const style = document.createElement('style');
    style.id = 'redact-prompt-styles';
    style.textContent = `
      @keyframes redact-slide-in {
        from { transform: translateY(12px); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <span style="font-size:16px;">🔒</span>
      <p style="margin:0;font-weight:600;font-size:14px;">Sensitive file detected</p>
    </div>
    <p style="margin:0 0 12px;font-size:12px;color:#64748b;">Redact before saving?</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="rp-redact-now" style="background:#3b82f6;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:500;">Redact Now</button>
      <button id="rp-save-anyway" style="background:#f1f5f9;border:none;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;">Save Anyway</button>
      <button id="rp-dont-ask" style="background:transparent;border:none;padding:6px 8px;font-size:11px;color:#94a3b8;cursor:pointer;">Don't ask for this site</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const autoClose = setTimeout(() => {
    overlay.remove();
    if (downloadId != null) chrome.runtime.sendMessage({ type: 'RESUME_DOWNLOAD', downloadId });
  }, 15000);

  overlay.querySelector('#rp-redact-now')?.addEventListener('click', () => {
    clearTimeout(autoClose);
    // Cancel the paused download — user will get the redacted version from the web app
    if (downloadId != null) chrome.runtime.sendMessage({ type: 'CANCEL_DOWNLOAD', downloadId });
    window.open(buildEditorUrl(url, fileType), '_blank');
    overlay.remove();
  });

  overlay.querySelector('#rp-save-anyway')?.addEventListener('click', () => {
    clearTimeout(autoClose);
    if (downloadId != null) chrome.runtime.sendMessage({ type: 'RESUME_DOWNLOAD', downloadId });
    overlay.remove();
  });

  overlay.querySelector('#rp-dont-ask')?.addEventListener('click', async () => {
    clearTimeout(autoClose);
    await addSuppressedSite(window.location.hostname);
    if (downloadId != null) chrome.runtime.sendMessage({ type: 'RESUME_DOWNLOAD', downloadId });
    overlay.remove();
  });
}

// ── Receive prompt trigger from service worker (download interception) ─────────

chrome.runtime.onMessage.addListener((msg: ExtensionMessage) => {
  if (msg.type === 'SHOW_REDACT_PROMPT') {
    showPrompt(msg.url, msg.fileType, msg.downloadId);
  }
});

// ── Click-based interception (catches download links before browser initiates) ─

document.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  const link = target.closest<HTMLAnchorElement>('a[href]');
  if (!link) return;

  const href = link.href;
  const fileType = getFileTypeFromUrl(href);
  if (!fileType) return;

  const suppressed = await getSuppressedSites();
  if (suppressed.includes(window.location.hostname)) return;

  // Only intercept explicit download anchors or blank-target links
  if (link.hasAttribute('download') || link.getAttribute('target') === '_blank') {
    showPrompt(href, fileType);
  }
});
