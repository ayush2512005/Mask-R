import { buildEditorUrl, getFileTypeFromUrl } from '../shared/messaging';

function injectRedactMenu(link: HTMLAnchorElement) {
  link.addEventListener('contextmenu', () => {
    const fileType = getFileTypeFromUrl(link.href);
    if (fileType) {
      chrome.runtime.sendMessage({
        type: 'OPEN_EDITOR',
        url: link.href,
        fileType,
      });
    }
  });
}

document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
  if (getFileTypeFromUrl(a.href)) injectRedactMenu(a);
});

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    m.addedNodes.forEach((node) => {
      if (node instanceof HTMLAnchorElement && getFileTypeFromUrl(node.href)) {
        injectRedactMenu(node);
      }
      if (node instanceof Element) {
        node.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
          if (getFileTypeFromUrl(a.href)) injectRedactMenu(a);
        });
      }
    });
  }
});

observer.observe(document.body, { childList: true, subtree: true });
