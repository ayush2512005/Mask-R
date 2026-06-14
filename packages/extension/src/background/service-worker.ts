import {
  buildEditorUrl,
  getFileTypeFromUrl,
  getSuppressedSites,
  setLiveModeEnabled,
  type ExtensionMessage,
  type PopupToSwMessage,
  type SwToContentMessage,
  type LiveDetectionResult,
} from '../shared/messaging';

const REDACTABLE_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.webp'];

// ── Context menus ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'redact-link',
    title: 'Redact with Redact',
    contexts: ['link'],
    targetUrlPatterns: REDACTABLE_EXTENSIONS.map((ext) => `*://*/*${ext}*`),
  });

  chrome.contextMenus.create({
    id: 'redact-image',
    title: 'Mask & Save with Redact',
    contexts: ['image'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  const url = info.linkUrl ?? info.srcUrl;
  if (!url) return;
  const fileType = getFileTypeFromUrl(url) ?? 'pdf';
  chrome.tabs.create({ url: buildEditorUrl(url, fileType) });
});

// ── Runtime messages (from content scripts and popup) ─────────────────────────

type InternalMessage =
  | ExtensionMessage
  | PopupToSwMessage
  | { type: 'RESUME_DOWNLOAD'; downloadId: number }
  | { type: 'CANCEL_DOWNLOAD'; downloadId: number }
  | { type: 'LIVE_MODE_STOPPED' };

chrome.runtime.onMessage.addListener((msg: InternalMessage, _sender, sendResponse) => {
  if (msg.type === 'OPEN_EDITOR') {
    chrome.tabs.create({ url: buildEditorUrl(msg.url, msg.fileType) });

  } else if (msg.type === 'OPEN_PDF_VIEWER') {
    chrome.tabs.create({ url: buildEditorUrl(msg.pdfUrl, 'pdf') });

  } else if (msg.type === 'RESUME_DOWNLOAD') {
    chrome.downloads.resume(msg.downloadId);

  } else if (msg.type === 'CANCEL_DOWNLOAD') {
    chrome.downloads.cancel(msg.downloadId);

  } else if (msg.type === 'LIVE_MODE_STOPPED') {
    // Popup closed with live mode off — persist state
    void setLiveModeEnabled(false);

  } else if (msg.type === 'LIVE_DETECTION_EVENT') {
    // Popup detected objects → forward notifications to the active tab (Story 6.2/6.3)
    void forwardDetectionNotifications(msg.detections);
    sendResponse({ ok: true });
  }

  return true; // keep message channel open for async responses
});

// ── Forward detection events to the active tab's content script ────────────────

async function forwardDetectionNotifications(detections: LiveDetectionResult[]): Promise<void> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return;

  for (const det of detections) {
    const msg: SwToContentMessage = {
      type: 'SHOW_LIVE_NOTIFICATION',
      detectionType: det.type,
      message: det.notification,
    };
    chrome.tabs.sendMessage(activeTab.id, msg).catch(() => {
      // Tab may not have the content script — ignore silently
    });
  }
}

// ── Download interception ──────────────────────────────────────────────────────

chrome.downloads.onCreated.addListener(async (item) => {
  const fileType = getFileTypeFromUrl(item.url);
  if (!fileType) return;

  try {
    const hostname = new URL(item.url).hostname;
    const suppressed = await getSuppressedSites();
    if (suppressed.includes(hostname)) return;
  } catch {
    return;
  }

  chrome.downloads.pause(item.id);

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id != null) {
    const prompt: ExtensionMessage = {
      type: 'SHOW_REDACT_PROMPT',
      url: item.url,
      fileType,
      downloadId: item.id,
    };
    chrome.tabs.sendMessage(activeTab.id, prompt).catch(() => {
      chrome.downloads.resume(item.id);
    });
  } else {
    chrome.downloads.resume(item.id);
  }
});
