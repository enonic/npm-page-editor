import type {Channel} from '../transport';

export type NavigationOptions = {
  hostDomain?: string;
};

function findAnchorElement(target: EventTarget | null): HTMLAnchorElement | undefined {
  if (!(target instanceof HTMLElement)) return undefined;
  return target.closest('a') ?? undefined;
}

function resolvePath(anchor: HTMLAnchorElement): string {
  return anchor.dataset.contentPath ?? anchor.getAttribute('href') ?? '';
}

function shouldIntercept(path: string, hostDomain: string | undefined): boolean {
  if (path === '' || path.startsWith('#') || path.startsWith('javascript:')) return false;
  if (path.startsWith('/')) return true;
  if (hostDomain != null && path.startsWith(hostDomain)) return true;
  return false;
}

export function initNavigationInterception(channel: Channel, options?: NavigationOptions): () => void {
  const hostDomain = options?.hostDomain;
  let warnedMissingHostDomain = false;

  const handleClick = (event: MouseEvent): void => {
    const anchor = findAnchorElement(event.target);
    if (anchor == null) return;
    if (anchor.hasAttribute('download')) return;

    const path = resolvePath(anchor);
    if (!shouldIntercept(path, hostDomain)) {
      if (
        hostDomain == null &&
        !warnedMissingHostDomain &&
        path !== '' &&
        !path.startsWith('#') &&
        !path.startsWith('javascript:') &&
        !path.startsWith('/')
      ) {
        warnedMissingHostDomain = true;
        // oxlint-disable-next-line no-console
        console.warn(
          `[page-editor] Navigation interception skipped absolute URL "${path}" — pass EditorOptions.hostDomain to classify it as internal.`,
        );
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    channel.send({type: 'navigate', path});
  };

  const sendIframeLoaded = (): void => {
    channel.send({type: 'iframe-loaded'});
  };

  document.addEventListener('click', handleClick, {capture: true});

  if (document.readyState !== 'loading') {
    sendIframeLoaded();
  } else {
    document.addEventListener('DOMContentLoaded', sendIframeLoaded, {once: true});
  }

  return () => {
    document.removeEventListener('click', handleClick, {capture: true});
    document.removeEventListener('DOMContentLoaded', sendIframeLoaded);
  };
}
