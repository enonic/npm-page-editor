const selectionMocks = vi.hoisted(() => ({
    selectEvents: [] as Array<{path: {toString(): string}; rightClicked: boolean}>,
    deselectEvents: [] as Array<{toString(): string}>,
    editEvents: [] as Array<{toString(): string}>,
    selectLegacyItemView: vi.fn(),
    deselectLegacyItemView: vi.fn(),
}));

const selectionGuards = vi.hoisted(() => ({
    isNewlyDropped: vi.fn(),
    isNextClickDisabled: vi.fn(),
    setNextClickDisabled: vi.fn(),
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/SelectComponentEvent', () => ({
    SelectComponentEvent: class {
        private readonly config: {path: {toString(): string}; rightClicked: boolean};

        constructor(config: {path: {toString(): string}; rightClicked: boolean}) {
            this.config = config;
        }

        fire(): void {
            selectionMocks.selectEvents.push(this.config);
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/outgoing/navigation/DeselectComponentEvent', () => ({
    DeselectComponentEvent: class {
        private readonly path: {toString(): string};

        constructor(path: {toString(): string}) {
            this.path = path;
        }

        fire(): void {
            selectionMocks.deselectEvents.push(this.path);
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/incoming/manipulation/EditTextComponentViewEvent', () => ({
    EditTextComponentViewEvent: class {
        private readonly path: {toString(): string};

        constructor(path: {toString(): string}) {
            this.path = path;
        }

        fire(): void {
            selectionMocks.editEvents.push(this.path);
        }
    },
}));

vi.mock('../../bridge', () => ({
    selectLegacyItemView: selectionMocks.selectLegacyItemView,
    deselectLegacyItemView: selectionMocks.deselectLegacyItemView,
}));

vi.mock('../../../DragAndDrop', () => ({
    DragAndDrop: {
        get: () => ({
            isNewlyDropped: selectionGuards.isNewlyDropped,
        }),
    },
}));

vi.mock('@enonic/lib-contentstudio/page-editor/PageViewController', () => ({
    PageViewController: {
        get: () => ({
            isNextClickDisabled: selectionGuards.isNextClickDisabled,
            setNextClickDisabled: selectionGuards.setNextClickDisabled,
        }),
    },
}));

import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {TEXT_COMPONENT_DBL_CLICK_TIMEOUT} from '../../../text/constants';
import type {ComponentRecord} from '../../types';
import {rebuildIndex} from '../../stores/element-index';
import {
    $contextMenuState,
    $selectedPath,
    closeContextMenu,
    setDragState,
    setRegistry,
    setSelectedPath,
    setTextEditing,
} from '../../stores/registry';
import {initSelectionDetection} from './selection-handler';

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
    afterEach(() => {
        document.body.innerHTML = '';
        setRegistry({});
        setSelectedPath(undefined);
        setTextEditing(false);
        setDragState(undefined);
        closeContextMenu();

        selectionMocks.selectEvents.length = 0;
        selectionMocks.deselectEvents.length = 0;
        selectionMocks.editEvents.length = 0;
        selectionMocks.selectLegacyItemView.mockReset();
        selectionMocks.deselectLegacyItemView.mockReset();
        selectionGuards.isNewlyDropped.mockReset();
        selectionGuards.isNextClickDisabled.mockReset();
        selectionGuards.setNextClickDisabled.mockReset();
        selectionGuards.isNewlyDropped.mockReturnValue(false);
        selectionGuards.isNextClickDisabled.mockReturnValue(false);
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
        expect(selectionMocks.selectLegacyItemView).toHaveBeenCalledWith('/main/0');
        expect(selectionMocks.selectEvents).toHaveLength(1);
        expect(selectionMocks.selectEvents[0].path.toString()).toBe('/main/0');
        expect(selectionMocks.selectEvents[0].rightClicked).toBe(false);

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
        expect(selectionMocks.deselectLegacyItemView).toHaveBeenCalledWith('/main/0');
        expect(selectionMocks.deselectEvents).toHaveLength(1);
        expect(selectionMocks.deselectEvents[0].toString()).toBe('/main/0');

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
        expect(selectionMocks.selectEvents).toHaveLength(1);
        expect(selectionMocks.selectEvents[0].rightClicked).toBe(true);

        stop();
    });

    it('does not hijack clicks while legacy text editing is active', () => {
        const element = document.createElement('article');
        element.dataset.portalComponentType = 'part';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element),
        };

        setRegistry(records);
        rebuildIndex(records);
        setTextEditing(true);

        const stop = initSelectionDetection();
        const event = new MouseEvent('click', {bubbles: true, cancelable: true});
        element.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect($selectedPath.get()).toBeUndefined();
        expect(selectionMocks.selectEvents).toHaveLength(0);
        expect(selectionMocks.selectLegacyItemView).not.toHaveBeenCalled();

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
        expect(selectionMocks.selectEvents).toHaveLength(0);

        stop();
    });

    it('suppresses the redundant click immediately after a drag drop', () => {
        const element = document.createElement('article');
        element.dataset.portalComponentType = 'part';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element),
        };

        setRegistry(records);
        rebuildIndex(records);
        selectionGuards.isNewlyDropped.mockReturnValue(true);

        const stop = initSelectionDetection();
        const event = new MouseEvent('click', {bubbles: true, cancelable: true});
        element.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect($selectedPath.get()).toBeUndefined();
        expect(selectionMocks.selectEvents).toHaveLength(0);

        stop();
    });

    it('consumes the legacy next-click-disabled guard', () => {
        const element = document.createElement('article');
        element.dataset.portalComponentType = 'part';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element),
        };

        setRegistry(records);
        rebuildIndex(records);
        selectionGuards.isNextClickDisabled.mockReturnValue(true);

        const stop = initSelectionDetection();
        const event = new MouseEvent('click', {bubbles: true, cancelable: true});
        element.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(selectionGuards.setNextClickDisabled).toHaveBeenCalledWith(false);
        expect(selectionMocks.selectEvents).toHaveLength(0);

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
        expect(selectionMocks.selectEvents).toHaveLength(0);

        vi.advanceTimersByTime(TEXT_COMPONENT_DBL_CLICK_TIMEOUT);

        expect($selectedPath.get()).toBe('/main/0');
        expect(selectionMocks.selectEvents).toHaveLength(1);
        expect(selectionMocks.editEvents).toHaveLength(0);

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
        expect(selectionMocks.selectEvents).toHaveLength(1);
        expect(selectionMocks.editEvents).toHaveLength(1);
        expect(selectionMocks.editEvents[0].toString()).toBe('/main/0');
        expect(selectionMocks.deselectEvents).toHaveLength(0);

        vi.advanceTimersByTime(TEXT_COMPONENT_DBL_CLICK_TIMEOUT);
        expect(selectionMocks.selectEvents).toHaveLength(1);

        stop();
    });
});
