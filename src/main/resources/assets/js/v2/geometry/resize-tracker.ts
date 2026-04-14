let observer: ResizeObserver | undefined;
const callbacks = new Map<Element, () => void>();

function getObserver(): ResizeObserver | undefined {
  if (typeof ResizeObserver === 'undefined') return undefined;

  observer ??= new ResizeObserver(entries => {
    for (const entry of entries) {
      callbacks.get(entry.target)?.();
    }
  });

  return observer;
}

export function trackElementResize(element: HTMLElement, onResize: () => void): () => void {
  const obs = getObserver();
  if (obs == null) return () => undefined;

  const isNew = !callbacks.has(element);
  callbacks.set(element, onResize);

  if (isNew) obs.observe(element);

  return () => {
    obs.unobserve(element);
    callbacks.delete(element);

    if (callbacks.size === 0) {
      obs.disconnect();
      observer = undefined;
    }
  };
}
