import type {ComponentPath} from './protocol';

import {updateRecord} from './state';

export type ComponentLoadCallback = (path: ComponentPath, existing: boolean) => void;

let current: ComponentLoadCallback | undefined;

export function setComponentLoadCallback(cb: ComponentLoadCallback | undefined): void {
  current = cb;
}

export function fireComponentLoadRequest(path: ComponentPath, existing: boolean): void {
  updateRecord(path, {loading: true});
  current?.(path, existing);
}
