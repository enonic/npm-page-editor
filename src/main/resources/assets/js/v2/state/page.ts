import {atom} from 'nanostores';

import type {PageConfig, PageController} from '../protocol';

export const $locked = atom<boolean>(false);
export const $modifyAllowed = atom<boolean>(true);
export const $config = atom<PageConfig | undefined>(undefined);
export const $pageControllers = atom<PageController[]>([]);

export function setLocked(value: boolean): void {
  $locked.set(value);
}

export function setModifyAllowed(value: boolean): void {
  $modifyAllowed.set(value);
}

export function setPageConfig(config: PageConfig): void {
  $config.set(config);
}

export function clearPageConfig(): void {
  $config.set(undefined);
}

export function getPageConfig(): PageConfig | undefined {
  return $config.get();
}

export function setPageControllers(controllers: PageController[]): void {
  $pageControllers.set(controllers);
}
