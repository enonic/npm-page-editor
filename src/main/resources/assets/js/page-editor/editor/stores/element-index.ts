import type {ComponentRecord} from '../types';

const elementIndex = new WeakMap<HTMLElement, string>();

export function rebuildIndex(records: Record<string, ComponentRecord>): void {
    Object.entries(records).forEach(([path, record]) => {
        if (record.element) {
            elementIndex.set(record.element, path);
        }
    });
}

export {elementIndex};
