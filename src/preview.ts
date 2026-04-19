import {initNavigationInterception} from './interaction/navigation';
import {createChannel, resetChannel, setChannel} from './transport';

export type PreviewOptions = {
  hostDomain?: string;
};

export type PreviewInstance = {
  destroy: () => void;
};

let currentPreview: PreviewInstance | undefined;

export function initPreview(target: Window, options?: PreviewOptions): PreviewInstance {
  if (currentPreview != null) {
    // oxlint-disable-next-line no-console
    console.warn('[page-editor] initPreview called while already initialized; returning existing instance.');
    return currentPreview;
  }

  const channel = createChannel(target);
  setChannel(channel);

  const stopNavigation = initNavigationInterception(channel, {hostDomain: options?.hostDomain});

  let destroyed = false;

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;

    stopNavigation();
    resetChannel();
    currentPreview = undefined;
  };

  currentPreview = {destroy};
  return currentPreview;
}
