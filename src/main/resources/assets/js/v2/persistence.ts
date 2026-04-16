import type {ComponentPath} from './protocol';

import {fromString, root} from './protocol/path';
import {$config, $selectedPath, getRecord, setSelectedPath} from './state';
import {getChannel} from './transport';

const STORAGE_KEY_PREFIX = 'pe-selected-path:';

function keyFor(contentId: string): string {
  return STORAGE_KEY_PREFIX + contentId;
}

function shouldPersist(path: ComponentPath, allowRootSelection: boolean): boolean {
  return allowRootSelection || path !== root();
}

function writeSelection(contentId: string, path: ComponentPath | undefined, allowRootSelection: boolean): void {
  const key = keyFor(contentId);
  if (path == null || !shouldPersist(path, allowRootSelection)) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, path);
}

function restoreSelection(contentId: string, allowRootSelection: boolean): void {
  const key = keyFor(contentId);
  const stored = sessionStorage.getItem(key);
  if (stored == null) return;

  const parsed = fromString(stored);
  if (!parsed.ok) {
    sessionStorage.removeItem(key);
    return;
  }

  const path = parsed.value;
  if (!shouldPersist(path, allowRootSelection)) return;

  if (getRecord(path) == null) {
    sessionStorage.removeItem(key);
    return;
  }

  setSelectedPath(path);
  getChannel().send({type: 'select', path});
}

export function initSelectionPersistence(): () => void {
  let selectionUnsubscribe: (() => void) | undefined;
  let configUnsubscribe: (() => void) | undefined;

  const activate = (contentId: string, allowRootSelection: boolean): void => {
    restoreSelection(contentId, allowRootSelection);
    selectionUnsubscribe = $selectedPath.listen(path => {
      writeSelection(contentId, path, allowRootSelection);
    });
  };

  const initialConfig = $config.get();
  if (initialConfig != null) {
    activate(initialConfig.contentId, Boolean(initialConfig.fragment));
  } else {
    configUnsubscribe = $config.listen(config => {
      if (config == null) return;
      configUnsubscribe?.();
      configUnsubscribe = undefined;
      activate(config.contentId, Boolean(config.fragment));
    });
  }

  return () => {
    selectionUnsubscribe?.();
    selectionUnsubscribe = undefined;
    configUnsubscribe?.();
    configUnsubscribe = undefined;
  };
}
