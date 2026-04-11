import type {PageView} from '../page-editor/PageView';
import {registerBusHandlers} from './adapter/bus-adapter';
import {destroyPlaceholders, reconcilePage} from './adapter/reconcile';
import {setCurrentPageView} from './bridge';
import {resetOwnership, transferOwnership} from './coexistence/ownership';
import {initGeometryTriggers} from './geometry/scheduler';
import {initHoverDetection} from './interaction/hover-handler';
import {initKeyboardHandling} from './interaction/keyboard-handler';
import {initSelectionDetection} from './interaction/selection-handler';
import {OverlayApp} from './components/OverlayApp';
import {createOverlayHost} from './rendering/overlay-host';
import {setLocked, setModifyAllowed, setSelectedPath} from './stores/registry';

function startDomObserver(pageView: PageView): () => void {
    if (typeof MutationObserver === 'undefined') {
        return () => undefined;
    }

    const observer = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.type === 'childList')) {
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
    if (pageView.getLiveEditParams().isFragment) {
        return () => undefined;
    }

    setCurrentPageView(pageView);

    transferOwnership('placeholder');
    transferOwnership('highlighter');
    transferOwnership('selection');
    transferOwnership('shader');
    transferOwnership('hover-detection');
    transferOwnership('click-selection');
    transferOwnership('keyboard');

    document.body.classList.add('pe-overlay-active');

    const overlay = createOverlayHost(<OverlayApp />);
    const stopGeometry = initGeometryTriggers();
    const stopHover = initHoverDetection();
    const stopSelection = initSelectionDetection();
    const stopKeyboard = initKeyboardHandling();
    const stopBus = registerBusHandlers(pageView);
    const stopObserver = startDomObserver(pageView);

    reconcilePage(pageView);
    setLocked(pageView.isLocked());
    setModifyAllowed(pageView.getLiveEditParams().modifyPermissions !== false);
    setSelectedPath(pageView.getSelectedView()?.getPath().toString());

    return () => {
        stopObserver();
        stopBus();
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
