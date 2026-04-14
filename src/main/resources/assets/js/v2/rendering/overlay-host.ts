import {render, type ReactNode} from 'preact/compat';

import {injectStyles} from './inject-styles';

const OVERLAY_HOST_ID = 'pe-overlay-host';
const OVERLAY_ROOT_ATTR = 'data-pe-overlay-root';

export type OverlayHost = {
  root: ShadowRoot;
  unmount: () => void;
};

export function createOverlayHost(app: ReactNode): OverlayHost {
  const host = document.createElement('div');
  host.id = OVERLAY_HOST_ID;
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '2147483646';
  document.body.appendChild(host);

  const shadow = host.attachShadow({mode: 'open'});
  injectStyles(shadow);

  const mount = document.createElement('div');
  mount.setAttribute(OVERLAY_ROOT_ATTR, 'true');
  shadow.appendChild(mount);
  render(app, mount);

  return {
    root: shadow,
    unmount: () => {
      render(null, mount);
      host.remove();
    },
  };
}
