const selectionMocks = vi.hoisted(() => ({
    selectEvents: [] as Array<{path: {toString(): string}; rightClicked: boolean}>,
    deselectEvents: [] as Array<{toString(): string}>,
    selectLegacyItemView: vi.fn(),
    deselectLegacyItemView: vi.fn(),
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

vi.mock('../bridge', () => ({
    selectLegacyItemView: selectionMocks.selectLegacyItemView,
    deselectLegacyItemView: selectionMocks.deselectLegacyItemView,
}));

import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import type {ComponentRecord} from '../types';
import {rebuildIndex} from '../stores/element-index';
import {
    $contextMenuState,
    $selectedPath,
    closeContextMenu,
    setRegistry,
    setSelectedPath,
} from '../stores/registry';
import {initSelectionDetection} from './selection-handler';

function createRecord(path: string, element: HTMLElement): ComponentRecord {
    return {
        path: ComponentPath.fromString(path),
        type: 'part',
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
        closeContextMenu();

        selectionMocks.selectEvents.length = 0;
        selectionMocks.deselectEvents.length = 0;
        selectionMocks.selectLegacyItemView.mockReset();
        selectionMocks.deselectLegacyItemView.mockReset();
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
});
