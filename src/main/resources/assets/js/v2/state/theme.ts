import {atom} from 'nanostores';

export type Theme = 'light' | 'dark';

export const $theme = atom<Theme>('light');

export function setTheme(theme: Theme): void {
  $theme.set(theme);
}

export function getTheme(): Theme {
  return $theme.get();
}
