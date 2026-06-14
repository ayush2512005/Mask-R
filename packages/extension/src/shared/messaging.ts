// NOTE: localhost for local testing. Switch back to 'https://app.redact.io' before shipping.
export const WEB_APP_BASE = 'http://localhost:5173';

// ─── Existing file/editor messages ────────────────────────────────────────────

export type ExtensionMessage =
  | { type: 'OPEN_EDITOR'; url: string; fileType: string }
  | { type: 'OPEN_PDF_VIEWER'; pdfUrl: string }
  | { type: 'SHOW_REDACT_PROMPT'; url: string; fileType: string; downloadId: number };

export function buildEditorUrl(fileUrl: string, fileType: string): string {
  const params = new URLSearchParams({ source: 'extension', url: fileUrl, type: fileType });
  return `${WEB_APP_BASE}/editor?${params.toString()}`;
}

export function getFileTypeFromUrl(url: string): string | null {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0] ?? '';
  const map: Record<string, string> = {
    pdf: 'pdf', docx: 'docx', xlsx: 'xlsx',
    jpg: 'image', jpeg: 'image', png: 'image', webp: 'image',
  };
  return map[ext] ?? null;
}

export const SUPPRESSED_SITES_KEY = 'redact_suppressed_sites';

export async function getSuppressedSites(): Promise<string[]> {
  const result = await chrome.storage.local.get(SUPPRESSED_SITES_KEY);
  return (result[SUPPRESSED_SITES_KEY] as string[] | undefined) ?? [];
}

export async function addSuppressedSite(hostname: string): Promise<void> {
  const sites = await getSuppressedSites();
  if (!sites.includes(hostname)) {
    await chrome.storage.local.set({ [SUPPRESSED_SITES_KEY]: [...sites, hostname] });
  }
}

export async function removeSuppressedSite(hostname: string): Promise<void> {
  const sites = await getSuppressedSites();
  await chrome.storage.local.set({
    [SUPPRESSED_SITES_KEY]: sites.filter((s) => s !== hostname),
  });
}

// ─── Live Protection messages (Stories 6.1–6.3) ───────────────────────────────

export type DetectionType = 'face' | 'card' | 'plate' | 'document';

export interface LiveDetectionResult {
  type: DetectionType;
  label: string;
  notification: string;
  count: number;
}

/** Messages from popup → service worker */
export type PopupToSwMessage =
  | { type: 'LIVE_DETECTION_EVENT'; detections: LiveDetectionResult[] };

/** Messages from service worker → content script */
export type SwToContentMessage =
  | { type: 'SHOW_LIVE_NOTIFICATION'; detectionType: DetectionType; message: string };

// ─── Zone persistence (FR-33) ─────────────────────────────────────────────────

export const LIVE_ZONES_KEY = 'redact_live_zones';
export const LIVE_MODE_KEY = 'redact_live_mode_enabled';

export interface CameraZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function getLiveZones(): Promise<CameraZone[]> {
  const result = await chrome.storage.local.get(LIVE_ZONES_KEY);
  return (result[LIVE_ZONES_KEY] as CameraZone[] | undefined) ?? [];
}

export async function saveLiveZones(zones: CameraZone[]): Promise<void> {
  await chrome.storage.local.set({ [LIVE_ZONES_KEY]: zones });
}

export async function getLiveModeEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(LIVE_MODE_KEY);
  return (result[LIVE_MODE_KEY] as boolean | undefined) ?? false;
}

export async function setLiveModeEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [LIVE_MODE_KEY]: enabled });
}

// ─── Face blur & auto-blur-docs settings (Stories 6.4, 6.5) ──────────────────

export const FACE_BLUR_KEY = 'redact_face_blur_enabled';
export const AUTO_BLUR_DOCS_KEY = 'redact_auto_blur_docs';

export async function getFaceBlurEnabled(): Promise<boolean> {
  const r = await chrome.storage.local.get(FACE_BLUR_KEY);
  return (r[FACE_BLUR_KEY] as boolean | undefined) ?? false;
}

export async function setFaceBlurEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [FACE_BLUR_KEY]: enabled });
}

export async function getAutoBlurDocs(): Promise<boolean> {
  const r = await chrome.storage.local.get(AUTO_BLUR_DOCS_KEY);
  return (r[AUTO_BLUR_DOCS_KEY] as boolean | undefined) ?? false;
}

export async function setAutoBlurDocs(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [AUTO_BLUR_DOCS_KEY]: enabled });
}
