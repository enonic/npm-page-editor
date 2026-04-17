import {$theme} from '../state/theme';

const hosts = new Set<Element>();
let unsubscribe: (() => void) | undefined;

function apply(theme: 'light' | 'dark'): void {
  const isDark = theme === 'dark';
  for (const host of hosts) {
    host.classList.toggle('dark', isDark);
  }
}

function ensureSubscription(): void {
  if (unsubscribe != null) return;
  unsubscribe = $theme.subscribe(apply);
}

export function registerThemeHost(host: Element): void {
  hosts.add(host);
  ensureSubscription();
  host.classList.toggle('dark', $theme.get() === 'dark');
}

export function unregisterThemeHost(host: Element): void {
  hosts.delete(host);
  if (hosts.size === 0 && unsubscribe != null) {
    unsubscribe();
    unsubscribe = undefined;
  }
}
