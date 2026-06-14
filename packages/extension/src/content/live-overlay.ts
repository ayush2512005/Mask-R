/**
 * Live Overlay Content Script — Stories 6.2/6.3 (FR-29, FR-30)
 *
 * Listens for SHOW_LIVE_NOTIFICATION messages from the service worker
 * (which relays detection events from the popup) and renders non-blocking
 * toast notifications on the page within 200ms of receipt.
 */

import type { SwToContentMessage, DetectionType } from '../shared/messaging';

// ─── Toast container setup ────────────────────────────────────────────────────

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (container && document.body.contains(container)) return container;

  container = document.createElement('div');
  container.id = '__redact_live_overlay__';
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483647',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-end',
    pointerEvents: 'none',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });
  document.body.appendChild(container);
  return container;
}

// ─── Toast rendering ──────────────────────────────────────────────────────────

const TOAST_ICONS: Record<DetectionType, string> = {
  card: '💳',
  plate: '🚗',
  face: '👤',
  document: '📄',
};

const TOAST_COLORS: Record<DetectionType, { bg: string; border: string; text: string }> = {
  card: { bg: '#fff3cd', border: '#ffc107', text: '#664d03' },
  plate: { bg: '#d1ecf1', border: '#17a2b8', text: '#0c5460' },
  face: { bg: '#d4edda', border: '#28a745', text: '#155724' },
  document: { bg: '#f3e8ff', border: '#a855f7', text: '#581c87' },
};

// Deduplicate: don't show the same type twice within the cooldown window
const lastShownAt = new Map<DetectionType, number>();
const TOAST_COOLDOWN_MS = 5_000;

function showToast(detectionType: DetectionType, message: string): void {
  const now = Date.now();
  const last = lastShownAt.get(detectionType) ?? 0;
  if (now - last < TOAST_COOLDOWN_MS) return;
  lastShownAt.set(detectionType, now);

  const c = getContainer();
  const colors = TOAST_COLORS[detectionType];
  const icon = TOAST_ICONS[detectionType];

  const toast = document.createElement('div');
  Object.assign(toast.style, {
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
    opacity: '0',
    transform: 'translateY(8px)',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
    maxWidth: '320px',
    lineHeight: '1.4',
    pointerEvents: 'auto',
  });

  const iconSpan = document.createElement('span');
  iconSpan.textContent = icon;
  iconSpan.style.fontSize = '16px';

  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  const shieldBadge = document.createElement('span');
  shieldBadge.textContent = '🛡 Redact';
  Object.assign(shieldBadge.style, {
    marginLeft: '4px',
    fontSize: '10px',
    opacity: '0.7',
    fontWeight: 'normal',
    whiteSpace: 'nowrap',
  });

  toast.appendChild(iconSpan);
  toast.appendChild(textSpan);
  toast.appendChild(shieldBadge);
  c.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Auto-dismiss after 4s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 220);
  }, 4_000);
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg: SwToContentMessage | Record<string, unknown>) => {
  if (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    msg.type === 'SHOW_LIVE_NOTIFICATION'
  ) {
    const notification = msg as SwToContentMessage & { type: 'SHOW_LIVE_NOTIFICATION' };
    showToast(notification.detectionType, notification.message);
  }
});
