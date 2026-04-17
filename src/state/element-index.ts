import type {ComponentPath} from '../protocol';
import type {ComponentRecord} from './registry';

let elementIndex = new WeakMap<HTMLElement, ComponentPath>();

export function rebuildIndex(registry: Record<string, ComponentRecord>): void {
  elementIndex = new WeakMap();
  for (const record of Object.values(registry)) {
    if (record.element != null) {
      elementIndex.set(record.element, record.path);
    }
  }
}

export function getPathForElement(element: HTMLElement): ComponentPath | undefined {
  return elementIndex.get(element);
}
