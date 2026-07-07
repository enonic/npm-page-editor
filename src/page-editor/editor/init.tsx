import type {EditorBus} from '../protocol';

import {registerBusHandlers} from './adapter/bus-adapter';
import {destroyPlaceholders, initPlaceholderDragSync} from './adapter/placeholder-lifecycle';
import {reconcilePage, setPageRoot} from './adapter/reconcile';
import {OverlayApp} from './components/OverlayApp';
import {initGeometryTriggers} from './geometry/scheduler';
import {initComponentDrag, initContextWindowDrag} from './interaction/drag';
import {initHoverDetection} from './interaction/hover';
import {initKeyboardHandling} from './interaction/keyboard';
import {initSelectionDetection} from './interaction/selection';
import {isEditorInjectedElement} from './parse/emptiness';
import {restoreStoredSelection, syncSelectionStorage} from './persistence/selection-storage';
import {createOverlayHost} from './rendering/overlay-host';
import {getParams} from './stores/params';
import {setLocked, setModifyAllowed} from './stores/registry';
import {prepareTextComponents} from './text/text-component';

function hasMeaningfulMutation(mutation: MutationRecord): boolean {
    return [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)].some(
        node => !(node instanceof Element) || !isEditorInjectedElement(node),
    );
}

function startDomObserver(root: HTMLElement): () => void {
    if (typeof MutationObserver === 'undefined') {
        return () => undefined;
    }

    const observer = new MutationObserver(mutations => {
        if (mutations.some(mutation => mutation.type === 'childList' && hasMeaningfulMutation(mutation))) {
            window.queueMicrotask(() => reconcilePage());
        }
    });

    observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
    });

    return () => observer.disconnect();
}

/**
 * Boots the Preact runtime against the page root element (the live-edit body).
 * Lock state and the initial selection come from params/stored selection, and
 * the DOM is reconciled directly from `root`.
 */
export function initNewUi(root: HTMLElement, bus: EditorBus): () => void {
    setPageRoot(root);

    document.body.classList.add('pe-overlay-active');

    const overlay = createOverlayHost(<OverlayApp />);
    const stopGeometry = initGeometryTriggers();
    const stopHover = initHoverDetection();
    const stopSelection = initSelectionDetection();
    const stopKeyboard = initKeyboardHandling();
    const stopComponentDrag = initComponentDrag();
    const stopContextWindowDrag = initContextWindowDrag(bus);
    const stopBus = registerBusHandlers(bus);
    const stopPlaceholderDragSync = initPlaceholderDragSync();
    const stopObserver = startDomObserver(root);
    const params = getParams();
    const stopSelectionStorage = syncSelectionStorage(params?.contentId, params?.isFragment);

    reconcilePage();
    prepareTextComponents();
    setLocked(params?.locked === true || params?.modifyPermissions === false);
    setModifyAllowed(params?.modifyPermissions !== false);
    restoreStoredSelection(params?.contentId, params?.isFragment);

    return () => {
        stopSelectionStorage();
        stopObserver();
        stopPlaceholderDragSync();
        stopBus();
        stopContextWindowDrag();
        stopComponentDrag();
        stopKeyboard();
        stopSelection();
        stopHover();
        stopGeometry();
        destroyPlaceholders();
        overlay.unmount();
        document.body.classList.remove('pe-overlay-active');
        setPageRoot(undefined);
        setModifyAllowed(true);
    };
}
