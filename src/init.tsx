import './rendering/editor-fonts.css';
import './rendering/editor-ui.css';
import type {DescriptorMap} from './parse';
import type {ComponentPath, PageConfig} from './protocol';
import type {ComponentRecord} from './state';

import {OverlayApp} from './components/OverlayApp';
import {initGeometryScheduler} from './geometry';
import {initComponentDrag} from './interaction/component-drag';
import {initContextWindowDrag} from './interaction/context-window-drag';
import {initHoverDetection} from './interaction/hover';
import {initKeyboardHandling} from './interaction/keyboard';
import {initNavigationInterception} from './interaction/navigation';
import {initSelectionDetection} from './interaction/selection';
import {isEditorInjectedElement} from './parse/emptiness';
import {initSelectionPersistence} from './persistence';
import {destroyPlaceholders, reconcilePage, resetPageReadyFlag} from './reconcile';
import {createOverlayHost} from './rendering/overlay-host';
import {
  clearPageConfig,
  closeContextMenu,
  findRecordsByDescriptor,
  getPageConfig,
  getRecord,
  resetDragState,
  setHoveredPath,
  setLocked,
  setModifyAllowed,
  setPageControllers,
  setRegistry,
  setSelectedPath,
} from './state';
import {createAdapter, createChannel, resetChannel, setChannel} from './transport';

export type EditorOptions = {
  hostDomain?: string;
  onComponentLoadRequest?: (path: ComponentPath, existing: boolean) => void;
};

export type PageEditorInstance = {
  destroy: () => void;
  notifyComponentLoaded: (path: ComponentPath) => void;
  notifyComponentLoadFailed: (path: ComponentPath, reason: string) => void;
  requestPageReload: () => void;
  getConfig: () => PageConfig | undefined;
  getRecord: (path: ComponentPath) => ComponentRecord | undefined;
  getElement: (path: ComponentPath) => HTMLElement | undefined;
  findRecordsByDescriptor: (descriptor: string) => readonly ComponentRecord[];
};

let currentInstance: PageEditorInstance | undefined;

function hasMeaningfulMutation(mutation: MutationRecord): boolean {
  return [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)].some(
    node => !(node instanceof Element) || !isEditorInjectedElement(node),
  );
}

function startDomObserver(root: HTMLElement, onReconcile: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => undefined;

  let pending = false;
  const observer = new MutationObserver(mutations => {
    if (!mutations.some(m => m.type === 'childList' && hasMeaningfulMutation(m))) return;
    if (pending) return;

    pending = true;
    queueMicrotask(() => {
      pending = false;
      onReconcile();
    });
  });

  observer.observe(root, {childList: true, subtree: true});

  return () => observer.disconnect();
}

export function initPageEditor(root: HTMLElement, target: Window, options?: EditorOptions): PageEditorInstance {
  if (currentInstance != null) {
    // oxlint-disable-next-line no-console
    console.warn('[page-editor] initPageEditor called while already initialized; returning existing instance.');
    return currentInstance;
  }

  const channel = createChannel(target);
  setChannel(channel);

  document.body.classList.add('pe-overlay-active');

  const overlay = createOverlayHost(<OverlayApp />);

  let currentDescriptors: DescriptorMap = {};

  const safeReconcile = (): void => {
    try {
      reconcilePage(root, currentDescriptors);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // oxlint-disable-next-line no-console
      console.error('[page-editor] reconcile failed:', error);
      channel.send({type: 'error', phase: 'reconcile', message});
    }
  };

  const stopAdapter = createAdapter(channel, {
    onPageState: page => {
      currentDescriptors = page.components;
      safeReconcile();
    },
    onComponentLoadRequest: options?.onComponentLoadRequest,
  });
  const stopGeometry = initGeometryScheduler(path => getRecord(path)?.element);
  const stopHover = initHoverDetection();
  const stopSelection = initSelectionDetection(channel);
  const stopKeyboard = initKeyboardHandling(channel);
  const stopNavigation = initNavigationInterception(channel, {hostDomain: options?.hostDomain});
  const stopComponentDrag = initComponentDrag(channel);
  const stopContextDrag = initContextWindowDrag(channel);
  const stopPersistence = initSelectionPersistence();
  const stopObserver = startDomObserver(root, safeReconcile);

  channel.send({type: 'ready'});

  let destroyed = false;

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;

    stopObserver();
    stopPersistence();
    stopContextDrag();
    stopComponentDrag();
    stopNavigation();
    stopKeyboard();
    stopSelection();
    stopHover();
    stopGeometry();
    stopAdapter();

    destroyPlaceholders();
    overlay.unmount();
    document.body.classList.remove('pe-overlay-active');

    setSelectedPath(undefined);
    setHoveredPath(undefined);
    setRegistry({});
    setPageControllers([]);
    setLocked(false);
    setModifyAllowed(true);
    clearPageConfig();
    resetDragState();
    closeContextMenu();

    resetPageReadyFlag();
    resetChannel();
    currentInstance = undefined;
  };

  const instance: PageEditorInstance = {
    destroy,
    notifyComponentLoaded: path => channel.send({type: 'component-loaded', path}),
    notifyComponentLoadFailed: (path, reason) => channel.send({type: 'component-load-failed', path, reason}),
    requestPageReload: () => channel.send({type: 'page-reload-request'}),
    getConfig: () => getPageConfig(),
    getRecord: path => getRecord(path),
    getElement: path => getRecord(path)?.element,
    findRecordsByDescriptor: descriptor => findRecordsByDescriptor(descriptor),
  };

  currentInstance = instance;
  return instance;
}
