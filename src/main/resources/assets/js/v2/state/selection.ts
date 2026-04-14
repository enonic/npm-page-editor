import {atom} from 'nanostores';

import type {ComponentPath} from '../protocol';

export const $selectedPath = atom<ComponentPath | undefined>(undefined);

export function setSelectedPath(path: ComponentPath | undefined): void {
  $selectedPath.set(path);
}

export function getSelectedPath(): ComponentPath | undefined {
  return $selectedPath.get();
}
