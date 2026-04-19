import {atom} from 'nanostores';

import type {ComponentPath} from '../protocol';

export type SetSelectedPathOptions = {
  silent?: boolean;
};

export const $selectedPath = atom<ComponentPath | undefined>(undefined);
export const $silentSelection = atom<boolean>(false);

export function setSelectedPath(path: ComponentPath | undefined, options?: SetSelectedPathOptions): void {
  // ? Write the companion flag before the path so subscribers that react to
  // $selectedPath see a consistent pair when they read $silentSelection.
  $silentSelection.set(options?.silent === true);
  $selectedPath.set(path);
}

export function getSelectedPath(): ComponentPath | undefined {
  return $selectedPath.get();
}
