import type {Channel} from '../transport';

export type NavigationOptions = {
  // ? Consumed by the link classifier in gap G20; accepted now to lock the public shape.
  hostDomain?: string;
};

function findAnchorElement(target: EventTarget | null): HTMLAnchorElement | undefined {
  if (!(target instanceof HTMLElement)) return undefined;
  return target.closest('a') ?? undefined;
}

export function initNavigationInterception(channel: Channel, _options?: NavigationOptions): () => void {
  const handleClick = (event: MouseEvent): void => {
    const anchor = findAnchorElement(event.target);
    if (anchor == null) return;

    const href = anchor.getAttribute('href');
    if (href == null || href === '' || href.startsWith('#') || href.startsWith('javascript:')) return;

    event.preventDefault();
    event.stopPropagation();
    channel.send({type: 'navigate', path: href});
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
