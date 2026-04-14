import {atom} from 'nanostores';

import type {ComponentPath} from '../protocol';

export const $hoveredPath = atom<ComponentPath | undefined>(undefined);

export function setHoveredPath(path: ComponentPath | undefined): void {
  $hoveredPath.set(path);
}

export function getHoveredPath(): ComponentPath | undefined {
  return $hoveredPath.get();
}
