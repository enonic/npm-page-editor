const initMocks = vi.hoisted(() => ({
    registerBusHandlers: vi.fn(() => vi.fn()),
    reconcilePage: vi.fn(),
    destroyPlaceholders: vi.fn(),
    setCurrentPageView: vi.fn(),
    transferOwnership: vi.fn(),
    resetOwnership: vi.fn(),
    initGeometryTriggers: vi.fn(() => vi.fn()),
    initHoverDetection: vi.fn(() => vi.fn()),
    initKeyboardHandling: vi.fn(() => vi.fn()),
    initSelectionDetection: vi.fn(() => vi.fn()),
    initDragSync: vi.fn(() => vi.fn()),
    initContextWindowDrag: vi.fn(() => vi.fn()),
    initTextEditingSync: vi.fn(() => vi.fn()),
    syncSelectionStorage: vi.fn(() => vi.fn()),
    restoreStoredSelection: vi.fn(),
    createOverlayHost: vi.fn(() => ({unmount: vi.fn()})),
}));

vi.mock('./adapter/bus-adapter', () => ({
    registerBusHandlers: initMocks.registerBusHandlers,
}));

vi.mock('./adapter/reconcile', () => ({
    reconcilePage: initMocks.reconcilePage,
    destroyPlaceholders: initMocks.destroyPlaceholders,
}));

vi.mock('./bridge', () => ({
    setCurrentPageView: initMocks.setCurrentPageView,
}));

vi.mock('./coexistence/ownership', () => ({
    transferOwnership: initMocks.transferOwnership,
    resetOwnership: initMocks.resetOwnership,
}));

vi.mock('./geometry/scheduler', () => ({
    initGeometryTriggers: initMocks.initGeometryTriggers,
}));

vi.mock('./interaction/hover-handler', () => ({
    initHoverDetection: initMocks.initHoverDetection,
}));

vi.mock('./interaction/keyboard-handler', () => ({
    initKeyboardHandling: initMocks.initKeyboardHandling,
}));

vi.mock('./interaction/selection-handler', () => ({
    initSelectionDetection: initMocks.initSelectionDetection,
}));

vi.mock('./interaction/drag-sync', () => ({
    initDragSync: initMocks.initDragSync,
}));

vi.mock('./interaction/context-window-drag', () => ({
    initContextWindowDrag: initMocks.initContextWindowDrag,
}));

vi.mock('./interaction/text-editing-sync', () => ({
    initTextEditingSync: initMocks.initTextEditingSync,
}));

vi.mock('./persistence/selection-storage', () => ({
    syncSelectionStorage: initMocks.syncSelectionStorage,
    restoreStoredSelection: initMocks.restoreStoredSelection,
}));

vi.mock('./rendering/overlay-host', () => ({
    createOverlayHost: initMocks.createOverlayHost,
}));

vi.mock('./components/OverlayApp', () => ({
    OverlayApp: () => null,
}));

import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {initNewUi} from './init';

describe('initNewUi', () => {
    afterEach(() => {
        document.body.className = '';

        initMocks.registerBusHandlers.mockClear();
        initMocks.reconcilePage.mockClear();
        initMocks.destroyPlaceholders.mockClear();
        initMocks.setCurrentPageView.mockClear();
        initMocks.transferOwnership.mockClear();
        initMocks.resetOwnership.mockClear();
        initMocks.initGeometryTriggers.mockClear();
        initMocks.initHoverDetection.mockClear();
        initMocks.initKeyboardHandling.mockClear();
        initMocks.initSelectionDetection.mockClear();
        initMocks.initDragSync.mockClear();
        initMocks.initContextWindowDrag.mockClear();
        initMocks.initTextEditingSync.mockClear();
        initMocks.syncSelectionStorage.mockClear();
        initMocks.restoreStoredSelection.mockClear();
        initMocks.createOverlayHost.mockClear();
    });

    it('boots the runtime for fragment pages and enables root-path persistence', () => {
        const pageView = {
            getLiveEditParams: () => ({
                isFragment: true,
                contentId: 'fragment-content',
                modifyPermissions: true,
            }),
            isLocked: () => false,
            getSelectedView: () => ({
                getPath: () => ComponentPath.root(),
            }),
            getHTMLElement: () => document.body,
        };

        const destroy = initNewUi(pageView as never);

        expect(initMocks.createOverlayHost).toHaveBeenCalledTimes(1);
        expect(initMocks.registerBusHandlers).toHaveBeenCalledWith(pageView);
        expect(initMocks.reconcilePage).toHaveBeenCalledWith(pageView);
        expect(initMocks.initDragSync).toHaveBeenCalledTimes(1);
        expect(initMocks.initContextWindowDrag).toHaveBeenCalledTimes(1);
        expect(initMocks.initTextEditingSync).toHaveBeenCalledTimes(1);
        expect(initMocks.syncSelectionStorage).toHaveBeenCalledWith('fragment-content', true);
        expect(initMocks.restoreStoredSelection).toHaveBeenCalledWith('fragment-content', true);
        expect(document.body.classList.contains('pe-overlay-active')).toBe(true);

        destroy();

        expect(initMocks.destroyPlaceholders).toHaveBeenCalledTimes(1);
        expect(initMocks.resetOwnership).toHaveBeenCalledTimes(1);
        expect(document.body.classList.contains('pe-overlay-active')).toBe(false);
    });
});
