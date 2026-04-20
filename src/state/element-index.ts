import type {ComponentPath} from '../protocol';
import type {ComponentRecord} from './registry';

let elementIndex = new WeakMap<HTMLElement, ComponentPath>();
let frozen = false;

// ! While frozen, `rebuildIndex` is a no-op so mid-drag hit-tests keep returning
// ! the element→path mappings captured before drag-start. A reconcile that slips
// ! past `isDragging()` (e.g., via `reconcileSubtree` on a text update dispatched
// ! from the host) would otherwise blow away the WeakMap and break `inferDropTarget`.
export function setElementIndexFrozen(flag: boolean): void {
  frozen = flag;
}

export function rebuildIndex(registry: Record<string, ComponentRecord>): void {
  if (frozen) return;
  elementIndex = new WeakMap();
  for (const record of Object.values(registry)) {
    if (record.element != null) {
      elementIndex.set(record.element, record.path);
    }
  }
}

// ? Walks up the DOM tree until a registered ancestor is found. The strict lookup used to
// ? return `undefined` for any element inside a fragment where the attribute strip missed an
// ? alias — the click-path fell through to page-deselect instead of selecting the fragment.
// ? With `D3` stripping all three aliases this is defense-in-depth, but it also lets callers
// ? route arbitrary child elements (text nodes, inline spans, SVG) without pre-walking.
export function getPathForElement(element: HTMLElement): ComponentPath | undefined {
  let current: HTMLElement | null = element;
  while (current != null) {
    const path = elementIndex.get(current);
    if (path != null) return path;
    current = current.parentElement;
  }
  return undefined;
}
