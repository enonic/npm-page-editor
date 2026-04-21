const initMocks = vi.hoisted(() => ({
    registerBusHandlers: vi.fn(() => vi.fn()),
    reconcilePage: vi.fn(),
    destroyPlaceholders: vi.fn(),
    initPlaceholderDragSync: vi.fn(() => vi.fn()),
    setCurrentPageView: vi.fn(),
    initGeometryTriggers: vi.fn(() => vi.fn()),
    initHoverDetection: vi.fn(() => vi.fn()),
    initKeyboardHandling: vi.fn(() => vi.fn()),
    initSelectionDetection: vi.fn(() => vi.fn()),
    initComponentDrag: vi.fn(() => vi.fn()),
    initContextWindowDrag: vi.fn(() => vi.fn()),
    syncSelectionStorage: vi.fn(() => vi.fn()),
    restoreStoredSelection: vi.fn(),
    createOverlayHost: vi.fn(() => ({unmount: vi.fn()})),
}));

vi.mock('./adapter/bus-adapter', () => ({
    registerBusHandlers: initMocks.registerBusHandlers,
}));

vi.mock('./adapter/reconcile', () => ({
    reconcilePage: initMocks.reconcilePage,
}));

vi.mock('./adapter/placeholder-lifecycle', () => ({
    destroyPlaceholders: initMocks.destroyPlaceholders,
    initPlaceholderDragSync: initMocks.initPlaceholderDragSync,
}));

vi.mock('./bridge', () => ({
    setCurrentPageView: initMocks.setCurrentPageView,
}));

vi.mock('./geometry/scheduler', () => ({
    initGeometryTriggers: initMocks.initGeometryTriggers,
}));

vi.mock('./interaction/hover', () => ({
    initHoverDetection: initMocks.initHoverDetection,
}));

vi.mock('./interaction/keyboard', () => ({
    initKeyboardHandling: initMocks.initKeyboardHandling,
}));

vi.mock('./interaction/selection', () => ({
    initSelectionDetection: initMocks.initSelectionDetection,
}));

vi.mock('./interaction/drag', () => ({
    initComponentDrag: initMocks.initComponentDrag,
    initContextWindowDrag: initMocks.initContextWindowDrag,
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
        initMocks.initGeometryTriggers.mockClear();
        initMocks.initHoverDetection.mockClear();
        initMocks.initKeyboardHandling.mockClear();
        initMocks.initSelectionDetection.mockClear();
        initMocks.initComponentDrag.mockClear();
        initMocks.initContextWindowDrag.mockClear();
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
        expect(initMocks.initComponentDrag).toHaveBeenCalledTimes(1);
        expect(initMocks.initContextWindowDrag).toHaveBeenCalledTimes(1);
        expect(initMocks.syncSelectionStorage).toHaveBeenCalledWith('fragment-content', true);
        expect(initMocks.restoreStoredSelection).toHaveBeenCalledWith('fragment-content', true);
        expect(document.body.classList.contains('pe-overlay-active')).toBe(true);

        destroy();

        expect(initMocks.destroyPlaceholders).toHaveBeenCalledTimes(1);
        expect(document.body.classList.contains('pe-overlay-active')).toBe(false);
    });
});
