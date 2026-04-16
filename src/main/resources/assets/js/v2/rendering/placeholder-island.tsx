import {render, type ReactNode} from 'react';

import {injectStyles} from './inject-styles';
import {registerThemeHost, unregisterThemeHost} from './theme-sync';

const PLACEHOLDER_HOST_ATTR = 'data-pe-placeholder-host';

export type PlaceholderIsland = {
  container: HTMLElement;
  host: HTMLElement;
  shadow: ShadowRoot;
  unmount: () => void;
};

export function createPlaceholderIsland(target: HTMLElement, content: ReactNode): PlaceholderIsland {
  const host = document.createElement('div');
  host.setAttribute(PLACEHOLDER_HOST_ATTR, 'true');
  host.style.display = 'block';
  host.style.width = '100%';
  host.style.height = '100%';
  target.appendChild(host);

  const shadow = host.attachShadow({mode: 'open'});
  injectStyles(shadow);

  registerThemeHost(host);

  const mount = document.createElement('div');
  mount.style.height = '100%';
  shadow.appendChild(mount);
  render(content, mount);

  return {
    container: target,
    host,
    shadow,
    unmount: () => {
      unregisterThemeHost(host);
      render(null, mount);
      host.remove();
    },
  };
}
