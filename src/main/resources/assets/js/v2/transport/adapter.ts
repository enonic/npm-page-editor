import type {ComponentPath, IncomingMessage, PageDescriptor} from '../protocol';
import type {Channel} from './channel';

import {
  setSelectedPath,
  setLocked,
  setModifyAllowed,
  setPageConfig,
  setPageControllers,
  setTheme,
  updateRecord,
  closeContextMenu,
} from '../state';

export type AdapterCallbacks = {
  onPageState?: (page: PageDescriptor) => void;
  onComponentLoadRequest?: (path: ComponentPath) => void;
};

export function createAdapter(channel: Channel, callbacks?: AdapterCallbacks): () => void {
  let initialized = false;
  const queue: IncomingMessage[] = [];

  function dispatch(message: IncomingMessage): void {
    switch (message.type) {
      case 'init':
        setPageConfig(message.config);
        setLocked(message.config.locked);
        setModifyAllowed(message.config.modifyPermissions);
        if (message.config.theme != null) {
          setTheme(message.config.theme);
        }
        break;

      case 'select':
        setSelectedPath(message.path);
        break;

      case 'deselect':
        setSelectedPath(undefined);
        closeContextMenu();
        break;

      case 'add':
      case 'remove':
      case 'move':
      case 'duplicate':
      case 'reset':
        break;

      case 'load':
        updateRecord(message.path, {loading: true});
        callbacks?.onComponentLoadRequest?.(message.path);
        break;

      case 'set-component-state':
        updateRecord(message.path, {loading: message.processing});
        break;

      case 'page-state':
        callbacks?.onPageState?.(message.page);
        break;

      case 'set-lock':
        setLocked(message.locked);
        break;

      case 'set-modify-allowed':
        setModifyAllowed(message.allowed);
        if (!message.allowed) {
          setLocked(true);
        }
        break;

      case 'set-theme':
        setTheme(message.theme);
        break;

      case 'create-draggable':
      case 'destroy-draggable':
      case 'set-draggable-visible':
        break;

      case 'page-controllers':
        setPageControllers(message.controllers);
        break;

      default: {
        const _exhaustive: never = message;
        void _exhaustive;
      }
    }
  }

  function handleMessage(message: IncomingMessage): void {
    if (!initialized) {
      if (message.type === 'init') {
        dispatch(message);
        initialized = true;
        let firstError: Error | undefined;
        for (const queued of queue) {
          try {
            dispatch(queued);
          } catch (error) {
            firstError ??= error instanceof Error ? error : new Error(String(error));
          }
        }
        queue.length = 0;
        if (firstError != null) throw firstError;
      } else {
        queue.push(message);
      }
      return;
    }

    dispatch(message);
  }

  return channel.subscribe(handleMessage);
}
