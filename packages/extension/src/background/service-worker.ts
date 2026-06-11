import {
  buildEditorUrl,
  getFileTypeFromUrl,
  getSuppressedSites,
  ExtensionMessage,
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

// ── Runtime messages (from content scripts) ────────────────────────────────────

type InternalMessage =
  | ExtensionMessage
  | { type: 'RESUME_DOWNLOAD'; downloadId: number }
  | { type: 'CANCEL_DOWNLOAD'; downloadId: number };

chrome.runtime.onMessage.addListener((msg: InternalMessage) => {
  if (msg.type === 'OPEN_EDITOR') {
    chrome.tabs.create({ url: buildEditorUrl(msg.url, msg.fileType) });
  } else if (msg.type === 'OPEN_PDF_VIEWER') {
    chrome.tabs.create({ url: buildEditorUrl(msg.pdfUrl, 'pdf') });
  } else if (msg.type === 'RESUME_DOWNLOAD') {
    chrome.downloads.resume(msg.downloadId);
  } else if (msg.type === 'CANCEL_DOWNLOAD') {
    chrome.downloads.cancel(msg.downloadId);
  }
});

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

  // Pause the download and notify the active tab so the content script can show the prompt
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
      // Tab may not have the content script — resume the download silently
      chrome.downloads.resume(item.id);
    });
  } else {
    chrome.downloads.resume(item.id);
  }
});
