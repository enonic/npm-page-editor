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
  onComponentLoadRequest?: (path: ComponentPath, existing: boolean) => void;
};

export function createAdapter(channel: Channel, callbacks?: AdapterCallbacks): () => void {
  let initialized = false;
  const queue: IncomingMessage[] = [];

  function reportError(phase: 'init' | 'handle', error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    // oxlint-disable-next-line no-console
    console.error(`[page-editor] ${phase} handler failed:`, error);
    channel.send({type: 'error', phase, message});
  }

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

      case 'load':
        updateRecord(message.path, {loading: true});
        callbacks?.onComponentLoadRequest?.(message.path, message.existing);
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

      // ? Handled by context-window-drag.ts via a parallel channel.subscribe — adapter only needs exhaustiveness here.
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
        try {
          dispatch(message);
        } catch (error) {
          reportError('init', error);
          return;
        }
        initialized = true;
        for (const queued of queue) {
          try {
            dispatch(queued);
          } catch (error) {
            reportError('handle', error);
          }
        }
        queue.length = 0;
      } else {
        queue.push(message);
      }
      return;
    }

    try {
      dispatch(message);
    } catch (error) {
      reportError('handle', error);
    }
  }

  return channel.subscribe(handleMessage);
}
