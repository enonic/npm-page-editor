vi.mock('./reconcile', async importOriginal => ({
    // Keep the real pure helpers (isInSubtree); stub the reconciling ones.
    ...(await importOriginal<typeof import('./reconcile')>()),
    markLoading: vi.fn(),
    reconcilePage: vi.fn(),
    reconcileSubtree: vi.fn(),
    remapInteractionPath: vi.fn(),
    shiftInteractionAfterRemoval: vi.fn(),
}));

vi.mock('../dom/mutate', () => ({
    addComponentElement: vi.fn(),
    duplicateComponentElement: vi.fn(),
    moveComponentElement: vi.fn(),
    removeComponentElement: vi.fn(),
    resetComponentElement: vi.fn(),
    setTextComponentHtml: vi.fn(),
}));

vi.mock('../dom/scroll', () => ({
    scrollComponentIntoView: vi.fn(),
}));

import {createFakeBusPair, type FakeBusPair} from '../../../test/fake-bus';
import {
    $contextMenuState,
    $hoveredPath,
    $locked,
    $modifyAllowed,
    $selectedPath,
    closeContextMenu,
    openContextMenu,
    setHoveredPath,
    setLocked,
    setModifyAllowed,
    setSelectedPath,
} from '../stores/registry';
import {destroyTransport, getBus, initTransport} from '../transport/bus';
import {registerBusHandlers} from './bus-adapter';
import {shiftInteractionAfterRemoval} from './reconcile';

describe('registerBusHandlers', () => {
    let pair: FakeBusPair;
    let stop: () => void;
    let posted: string[];

    beforeEach(() => {
        pair = createFakeBusPair();

        // Dispatch helpers (used by the move/duplicate/remove mirror) post via
        // the transport singleton; capture those posts here.
        posted = [];
        initTransport();
        vi.spyOn(getBus()!, 'post').mockImplementation(type => {
            posted.push(type);
        });

        setSelectedPath(undefined);
        setHoveredPath(undefined);
        setLocked(false);
        setModifyAllowed(true);
        closeContextMenu();
        stop = registerBusHandlers(pair.editor);
    });

    afterEach(() => {
        stop();
        pair.editor.destroy();
        pair.host.destroy();
        destroyTransport();
        vi.restoreAllMocks();
    });

    it('selects a component on an incoming select-component', () => {
        pair.host.post('select-component', {path: '/main/1'});

        expect($selectedPath.get()).toBe('/main/1');
    });

    it('ignores select-component with an empty path', () => {
        setSelectedPath('/main/0');
        pair.host.post('select-component', {path: ''});

        expect($selectedPath.get()).toBe('/main/0');
    });

    it('clears the selection and closes the menu on deselect-component', () => {
        setSelectedPath('/main/0');
        openContextMenu({kind: 'component', path: '/main/0', x: 0, y: 0});

        pair.host.post('deselect-component', {path: '/main/0'});

        expect($selectedPath.get()).toBeUndefined();
        expect($contextMenuState.get()).toBeUndefined();
    });

    it('deselects when a remove targets the selected component and notifies the host', () => {
        setSelectedPath('/main/0');
        openContextMenu({kind: 'component', path: '/main/0', x: 0, y: 0});

        pair.host.post('remove-component', {path: '/main/0'});

        expect($selectedPath.get()).toBeUndefined();
        expect($contextMenuState.get()).toBeUndefined();
        expect(posted).toContain('component-deselected');
    });

    it('clears the hovered path when a remove targets a hovered descendant', () => {
        setHoveredPath('/main/0/left/0');

        pair.host.post('remove-component', {path: '/main/0'});

        expect($hoveredPath.get()).toBeUndefined();
    });

    it('shifts later-sibling interaction paths when a remove targets an earlier sibling', () => {
        vi.mocked(shiftInteractionAfterRemoval).mockClear();

        pair.host.post('remove-component', {path: '/main/1'});

        expect(shiftInteractionAfterRemoval).toHaveBeenCalledWith('/main/1');
    });

    it('toggles the locked store on set-page-lock-state', () => {
        pair.host.post('set-page-lock-state', {locked: true});

        expect($locked.get()).toBe(true);
    });

    it('locks the page when modifications are disallowed', () => {
        pair.host.post('set-modify-allowed', {allowed: false});

        expect($modifyAllowed.get()).toBe(false);
        expect($locked.get()).toBe(true);
    });

    it('stops handling messages after teardown', () => {
        stop();
        pair.host.post('select-component', {path: '/main/2'});

        expect($selectedPath.get()).toBeUndefined();
    });
});
