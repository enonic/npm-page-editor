import {atom} from 'nanostores';

import type {ComponentPath} from '../protocol';

export type ContextMenuState = {
  kind: 'component' | 'locked-page';
  path: ComponentPath;
  x: number;
  y: number;
};

export const $contextMenu = atom<ContextMenuState | undefined>(undefined);

export function openContextMenu(state: ContextMenuState): void {
  $contextMenu.set(state);
}

export function closeContextMenu(): void {
  $contextMenu.set(undefined);
}
