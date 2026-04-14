import type {ComponentPath} from '../protocol';

export type ElementResolver = (path: ComponentPath) => HTMLElement | undefined;

type Consumer = {
  path: ComponentPath;
  callback: (rect: DOMRect) => void;
};

let resolver: ElementResolver | undefined;
const consumers = new Set<Consumer>();
let dirty = false;
let frameId: number | undefined;

function cloneDomRect(rect: DOMRect): DOMRect {
  return DOMRect.fromRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
}

function measure(): void {
  dirty = false;
  frameId = undefined;

  if (resolver == null) return;

  const resolve = resolver;

  consumers.forEach(consumer => {
    const element = resolve(consumer.path);
    if (element == null) return;

    consumer.callback(cloneDomRect(element.getBoundingClientRect()));
  });
}

export function markDirty(): void {
  if (dirty) return;

  dirty = true;
  frameId = window.requestAnimationFrame(measure);
}

export function registerConsumer(path: ComponentPath, callback: (rect: DOMRect) => void): () => void {
  const consumer: Consumer = {path, callback};
  consumers.add(consumer);
  markDirty();

  return () => {
    consumers.delete(consumer);
  };
}

export function initGeometryScheduler(elementResolver: ElementResolver): () => void {
  resolver = elementResolver;

  const handleScroll = (): void => markDirty();
  const handleResize = (): void => markDirty();

  document.addEventListener('scroll', handleScroll, {capture: true, passive: true});
  window.addEventListener('resize', handleResize, {passive: true});

  return () => {
    document.removeEventListener('scroll', handleScroll, {capture: true});
    window.removeEventListener('resize', handleResize);

    if (frameId != null) {
      window.cancelAnimationFrame(frameId);
      frameId = undefined;
    }

    dirty = false;
    resolver = undefined;
    consumers.clear();
  };
}
