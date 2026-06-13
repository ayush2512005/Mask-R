// NOTE: localhost for local testing. Switch back to 'https://app.redact.io' before shipping.
export const WEB_APP_BASE = 'http://localhost:5173';

export type ExtensionMessage =
  | { type: 'OPEN_EDITOR'; url: string; fileType: string }
  | { type: 'OPEN_PDF_VIEWER'; pdfUrl: string }
  | { type: 'SHOW_REDACT_PROMPT'; url: string; fileType: string; downloadId: number };

export function buildEditorUrl(fileUrl: string, fileType: string): string {
  const params = new URLSearchParams({
    source: 'extension',
    url: fileUrl,
    type: fileType,
  });
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
