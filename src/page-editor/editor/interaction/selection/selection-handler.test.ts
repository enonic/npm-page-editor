const selectionMocks = vi.hoisted(() => ({
    isNextClickDisabled: vi.fn(() => false),
    setNextClickDisabled: vi.fn(),
}));

vi.mock('../common/next-click', () => ({
    isNextClickDisabled: selectionMocks.isNextClickDisabled,
    setNextClickDisabled: selectionMocks.setNextClickDisabled,
}));

import type {EditorToHostType} from '../../../protocol';
import type {ComponentRecord} from '../../types';

import {ComponentPath} from '../../../protocol';
import {rebuildIndex} from '../../stores/element-index';
import {
    $contextMenuState,
    $selectedPath,
    closeContextMenu,
    setDragState,
    setRegistry,
    setSelectedPath,
} from '../../stores/registry';
import {destroyTransport, getBus, initTransport} from '../../transport/bus';
import {TEXT_COMPONENT_DBL_CLICK_TIMEOUT} from './constants';
import {initSelectionDetection} from './selection-handler';

type PostCall = {type: EditorToHostType; payload: {path?: string; rightClicked?: boolean}};

let posted: PostCall[];

const selectCalls = (): PostCall[] => posted.filter(call => call.type === 'component-selected');
const deselectCalls = (): PostCall[] => posted.filter(call => call.type === 'component-deselected');
const editCalls = (): PostCall[] => posted.filter(call => call.type === 'text-edit-requested');

function createRecord(path: string, element: HTMLElement, type: ComponentRecord['type'] = 'part'): ComponentRecord {
    return {
        path: ComponentPath.fromString(path),
        type,
        element,
        parentPath: '/main',
        children: [],
        empty: false,
        error: false,
        descriptor: 'app:part',
        loading: false,
    };
}

describe('initSelectionDetection', () => {
    beforeEach(() => {
        posted = [];
        initTransport();
        vi.spyOn(getBus()!, 'post').mockImplementation((type, payload) => {
            posted.push({type, payload} as PostCall);
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        setRegistry({});
        setSelectedPath(undefined);
        setDragState(undefined);
        closeContextMenu();
        destroyTransport();

        selectionMocks.setNextClickDisabled.mockReset();
        selectionMocks.isNextClickDisabled.mockReset();
        selectionMocks.isNextClickDisabled.mockReturnValue(false);
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('selects tracked components on click', () => {
        const element = document.createElement('article');
        element.dataset.portalComponentType = 'part';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element),
        };

        setRegistry(records);
        rebuildIndex(records);

        const stop = initSelectionDetection();
        const event = new MouseEvent('click', {bubbles: true, cancelable: true});
        element.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect($selectedPath.get()).toBe('/main/0');
        expect(selectCalls()).toHaveLength(1);
        expect(selectCalls()[0].payload.path).toBe('/main/0');
        expect(selectCalls()[0].payload.rightClicked).toBe(false);

        stop();
    });

    it('selects tracked components when the click lands on inline SVG content', () => {
        const element = document.createElement('article');
        element.dataset.portalComponentType = 'part';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        element.appendChild(svg);
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element),
        };

        setRegistry(records);
        rebuildIndex(records);

        const stop = initSelectionDetection();
        const event = new MouseEvent('click', {bubbles: true, cancelable: true});
        svg.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect($selectedPath.get()).toBe('/main/0');
        expect(selectCalls()).toHaveLength(1);
        expect(selectCalls()[0].payload.path).toBe('/main/0');

        stop();
    });

    it('deselects the current component when it is clicked again', () => {
        const element = document.createElement('article');
        element.dataset.portalComponentType = 'part';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element),
        };

        setRegistry(records);
        rebuildIndex(records);
        setSelectedPath('/main/0');

        const stop = initSelectionDetection();
        element.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

        expect($selectedPath.get()).toBeUndefined();
        expect(deselectCalls()).toHaveLength(1);
        expect(deselectCalls()[0].payload.path).toBe('/main/0');

        stop();
    });

    it('opens the new context menu state on right click', () => {
        const element = document.createElement('article');
        element.dataset.portalComponentType = 'part';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element),
        };

        setRegistry(records);
        rebuildIndex(records);

        const stop = initSelectionDetection();
        const event = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
        element.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect($selectedPath.get()).toBe('/main/0');
        expect($contextMenuState.get()).toMatchObject({
            kind: 'component',
            path: '/main/0',
        });
        expect(selectCalls()).toHaveLength(1);
        expect(selectCalls()[0].payload.rightClicked).toBe(true);

        stop();
    });

    it('does not hijack clicks while drag feedback is active', () => {
        const element = document.createElement('article');
        element.dataset.portalComponentType = 'part';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element),
        };

        setRegistry(records);
        rebuildIndex(records);
        setDragState({
            itemType: 'part',
            itemLabel: 'Hero',
            sourcePath: '/main/0',
            targetPath: '/main',
            dropAllowed: true,
            message: undefined,
            placeholderElement: undefined,
            x: 12,
            y: 16,
        });

        const stop = initSelectionDetection();
        const event = new MouseEvent('click', {bubbles: true, cancelable: true});
        element.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect($selectedPath.get()).toBeUndefined();
        expect(selectCalls()).toHaveLength(0);

        stop();
    });

    it('consumes the next-click-disabled guard', () => {
        const element = document.createElement('article');
        element.dataset.portalComponentType = 'part';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element),
        };

        setRegistry(records);
        rebuildIndex(records);
        selectionMocks.isNextClickDisabled.mockReturnValue(true);

        const stop = initSelectionDetection();
        const event = new MouseEvent('click', {bubbles: true, cancelable: true});
        element.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(selectionMocks.setNextClickDisabled).toHaveBeenCalledWith(false);
        expect(selectCalls()).toHaveLength(0);

        stop();
    });

    it('delays single-click selection for text components to preserve double-click editing', () => {
        vi.useFakeTimers();

        const element = document.createElement('article');
        element.dataset.portalComponentType = 'text';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element, 'text'),
        };

        setRegistry(records);
        rebuildIndex(records);

        const stop = initSelectionDetection();
        const event = new MouseEvent('click', {bubbles: true, cancelable: true});
        element.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect($selectedPath.get()).toBeUndefined();
        expect(selectCalls()).toHaveLength(0);

        vi.advanceTimersByTime(TEXT_COMPONENT_DBL_CLICK_TIMEOUT);

        expect($selectedPath.get()).toBe('/main/0');
        expect(selectCalls()).toHaveLength(1);
        expect(editCalls()).toHaveLength(0);

        stop();
    });

    it('enters text edit mode on double click without toggling selection off', () => {
        vi.useFakeTimers();

        const element = document.createElement('article');
        element.dataset.portalComponentType = 'text';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element, 'text'),
        };

        setRegistry(records);
        rebuildIndex(records);

        const stop = initSelectionDetection();
        element.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

        vi.advanceTimersByTime(TEXT_COMPONENT_DBL_CLICK_TIMEOUT - 1);
        element.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

        expect($selectedPath.get()).toBe('/main/0');
        expect(selectCalls()).toHaveLength(1);
        expect(editCalls()).toHaveLength(1);
        expect(editCalls()[0].payload.path).toBe('/main/0');
        expect(deselectCalls()).toHaveLength(0);

        vi.advanceTimersByTime(TEXT_COMPONENT_DBL_CLICK_TIMEOUT);
        expect(selectCalls()).toHaveLength(1);

        stop();
    });
});
