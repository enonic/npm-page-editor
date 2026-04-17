import {$theme} from '../state/theme';
import {registerThemeHost, unregisterThemeHost} from './theme-sync';

function createHost(): HTMLDivElement {
  return document.createElement('div');
}

describe('theme-sync', () => {
  beforeEach(() => {
    $theme.set('light');
  });

  it('applies current theme on registration', () => {
    $theme.set('dark');
    const host = createHost();

    registerThemeHost(host);

    expect(host.classList.contains('dark')).toBe(true);

    unregisterThemeHost(host);
  });

  it('does not add dark class in light theme', () => {
    const host = createHost();

    registerThemeHost(host);

    expect(host.classList.contains('dark')).toBe(false);

    unregisterThemeHost(host);
  });

  it('reacts to theme changes after registration', () => {
    const host = createHost();
    registerThemeHost(host);

    $theme.set('dark');
    expect(host.classList.contains('dark')).toBe(true);

    $theme.set('light');
    expect(host.classList.contains('dark')).toBe(false);

    unregisterThemeHost(host);
  });

  it('stops reacting after unregistration', () => {
    const host = createHost();
    registerThemeHost(host);
    unregisterThemeHost(host);

    $theme.set('dark');

    expect(host.classList.contains('dark')).toBe(false);
  });

  it('handles multiple hosts', () => {
    const host1 = createHost();
    const host2 = createHost();
    registerThemeHost(host1);
    registerThemeHost(host2);

    $theme.set('dark');

    expect(host1.classList.contains('dark')).toBe(true);
    expect(host2.classList.contains('dark')).toBe(true);

    unregisterThemeHost(host1);

    $theme.set('light');

    expect(host1.classList.contains('dark')).toBe(true);
    expect(host2.classList.contains('dark')).toBe(false);

    unregisterThemeHost(host2);
  });

  it('re-subscribes after all hosts unregistered and new one added', () => {
    const host1 = createHost();
    registerThemeHost(host1);
    unregisterThemeHost(host1);

    const host2 = createHost();
    registerThemeHost(host2);

    $theme.set('dark');
    expect(host2.classList.contains('dark')).toBe(true);

    unregisterThemeHost(host2);
  });
});
