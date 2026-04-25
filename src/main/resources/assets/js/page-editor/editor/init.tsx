import type {PageView} from '../PageView';
import {registerBusHandlers} from './adapter/bus-adapter';
import {destroyPlaceholders, initPlaceholderDragSync} from './adapter/placeholder-lifecycle';
import {reconcilePage} from './adapter/reconcile';
import {setCurrentPageView} from './bridge';
import {initGeometryTriggers} from './geometry/scheduler';
import {initHoverDetection} from './interaction/hover';
import {initKeyboardHandling} from './interaction/keyboard';
import {initSelectionDetection} from './interaction/selection';
import {initComponentDrag, initContextWindowDrag} from './interaction/drag';
import {restoreStoredSelection, syncSelectionStorage} from './persistence/selection-storage';
import {OverlayApp} from './components/OverlayApp';
import {createOverlayHost} from './rendering/overlay-host';
import {setLocked, setModifyAllowed, setSelectedPath} from './stores/registry';
import {isEditorInjectedElement} from './parse/emptiness';

function hasMeaningfulMutation(mutation: MutationRecord): boolean {
    return [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)]
        .some((node) => !(node instanceof Element) || !isEditorInjectedElement(node));
}

function startDomObserver(pageView: PageView): () => void {
    if (typeof MutationObserver === 'undefined') {
        return () => undefined;
    }

    const observer = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.type === 'childList' && hasMeaningfulMutation(mutation))) {
            window.queueMicrotask(() => reconcilePage(pageView));
        }
    });

    observer.observe(pageView.getHTMLElement(), {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
    });

    return () => observer.disconnect();
}

export function initNewUi(pageView: PageView): () => void {
    setCurrentPageView(pageView);

    document.body.classList.add('pe-overlay-active');

    const overlay = createOverlayHost(<OverlayApp />);
    const stopGeometry = initGeometryTriggers();
    const stopHover = initHoverDetection();
    const stopSelection = initSelectionDetection();
    const stopKeyboard = initKeyboardHandling();
    const stopComponentDrag = initComponentDrag();
    const stopContextWindowDrag = initContextWindowDrag();
    const stopBus = registerBusHandlers(pageView);
    const stopPlaceholderDragSync = initPlaceholderDragSync();
    const stopObserver = startDomObserver(pageView);
    const stopSelectionStorage = syncSelectionStorage(
        pageView.getLiveEditParams().contentId,
        pageView.getLiveEditParams().isFragment,
    );

    reconcilePage(pageView);
    setLocked(pageView.isLocked());
    setModifyAllowed(pageView.getLiveEditParams().modifyPermissions !== false);
    setSelectedPath(pageView.getSelectedView()?.getPath().toString());
    restoreStoredSelection(
        pageView.getLiveEditParams().contentId,
        pageView.getLiveEditParams().isFragment,
    );

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
        setCurrentPageView(undefined);
        setModifyAllowed(true);
    };
}
