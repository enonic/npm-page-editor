import type {PageView} from '../page-editor/PageView';
import {registerBusHandlers} from './adapter/bus-adapter';
import {destroyPlaceholders, reconcilePage} from './adapter/reconcile';
import {setCurrentPageView} from './bridge';
import {resetOwnership, transferOwnership} from './coexistence/ownership';
import {initGeometryTriggers} from './geometry/scheduler';
import {initHoverDetection} from './interaction/hover-handler';
import {initKeyboardHandling} from './interaction/keyboard-handler';
import {initSelectionDetection} from './interaction/selection-handler';
import {initComponentDrag} from './interaction/component-drag';
import {initContextWindowDrag} from './interaction/context-window-drag';
import {initTextEditingSync} from './interaction/text-editing-sync';
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

    transferOwnership('placeholder');
    transferOwnership('highlighter');
    transferOwnership('selection');
    transferOwnership('shader');
    transferOwnership('hover-detection');
    transferOwnership('click-selection');
    transferOwnership('keyboard');
    transferOwnership('drag-drop');
    transferOwnership('context-window-drag');

    document.body.classList.add('pe-overlay-active');

    const overlay = createOverlayHost(<OverlayApp />);
    const stopGeometry = initGeometryTriggers();
    const stopHover = initHoverDetection();
    const stopSelection = initSelectionDetection();
    const stopKeyboard = initKeyboardHandling();
    const stopComponentDrag = initComponentDrag();
    const stopContextWindowDrag = initContextWindowDrag();
    const stopTextEditing = initTextEditingSync();
    const stopBus = registerBusHandlers(pageView);
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
        stopBus();
        stopTextEditing();
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
        resetOwnership();
    };
}
