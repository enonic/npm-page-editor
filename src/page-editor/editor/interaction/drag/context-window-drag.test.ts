import type {EditorToHostType} from '../../../protocol';
import type {ComponentRecord} from '../../types';

import {createFakeBusPair, type FakeBusPair} from '../../../../test/fake-bus';
import {ComponentPath} from '../../../protocol';
import {rebuildIndex} from '../../stores/element-index';
import {$dragState, setDragState, setRegistry} from '../../stores/registry';
import {destroyTransport, getBus, initTransport} from '../../transport/bus';
import {initContextWindowDrag} from './context-window-drag';

type PostCall = {type: EditorToHostType; payload: {path?: string; from?: string; to?: string; kind?: string}};

let posted: PostCall[];
let pair: FakeBusPair;

const calls = (type: EditorToHostType): PostCall[] => posted.filter(call => call.type === type);

function createRecord(
    path: string,
    element: HTMLElement,
    type: ComponentRecord['type'],
    parentPath: string | undefined,
    children: string[] = [],
): ComponentRecord {
    return {
        path: ComponentPath.fromString(path),
        type,
        element,
        parentPath,
        children,
        empty: children.length === 0,
        error: false,
        descriptor: 'app:test',
        loading: false,
    };
}

function setRect(
    element: HTMLElement,
    {top, left, width, height}: {top: number; left: number; width: number; height: number},
): void {
    Object.defineProperty(element, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
            top,
            left,
            width,
            height,
            right: left + width,
            bottom: top + height,
            x: left,
            y: top,
            toJSON: () => undefined,
        }),
    });
}

describe('initContextWindowDrag', () => {
    beforeEach(() => {
        pair = createFakeBusPair();

        posted = [];
        initTransport();
        vi.spyOn(getBus()!, 'post').mockImplementation((type, payload) => {
            posted.push({type, payload} as PostCall);
        });

        Object.defineProperty(document, 'elementsFromPoint', {
            configurable: true,
            writable: true,
            value: vi.fn(),
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        setRegistry({});
        setDragState(undefined);
        pair.editor.destroy();
        pair.host.destroy();
        destroyTransport();
        vi.restoreAllMocks();
    });

    it('adds a component into the hovered region through the new runtime drag session', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const first = document.createElement('article');
        first.dataset.portalComponentType = 'part';
        const second = document.createElement('article');
        second.dataset.portalComponentType = 'part';
        region.append(first, second);
        document.body.appendChild(region);

        setRect(first, {top: 20, left: 0, width: 300, height: 80});
        setRect(second, {top: 120, left: 0, width: 300, height: 80});

        const records = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString(), ['/main/0', '/main/1']),
            '/main/0': createRecord('/main/0', first, 'part', '/main'),
            '/main/1': createRecord('/main/1', second, 'part', '/main'),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([first]);

        const stop = initContextWindowDrag(pair.editor);
        pair.host.post('create-or-destroy-draggable', {kind: 'part', create: true});
        pair.host.post('set-draggable-visible', {kind: 'part', visible: true});

        document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientX: 24, clientY: 32}));

        expect(calls('drag-started')).toHaveLength(1);
        expect($dragState.get()).toMatchObject({
            itemType: 'part',
            targetPath: '/main',
            dropAllowed: true,
        });

        const placeholderAnchor = $dragState.get()?.placeholderElement;
        expect(placeholderAnchor).toBeInstanceOf(HTMLElement);

        document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: 24, clientY: 32}));

        expect(calls('add-component-requested')).toHaveLength(1);
        expect(calls('add-component-requested')[0].payload).toEqual({path: '/main/0', kind: 'part'});
        expect(calls('drag-dropped')).toHaveLength(1);
        expect(calls('drag-dropped')[0].payload.to).toBe('/main/0');
        expect(calls('drag-canceled')).toHaveLength(0);
        expect(calls('drag-stopped')).toHaveLength(1);
        expect($dragState.get()).toBeUndefined();
        expect(placeholderAnchor?.isConnected).toBe(false);

        stop();
    });

    it('rejects nested layout inserts and preserves the cancel/stopped contract', () => {
        const layout = document.createElement('div');
        layout.dataset.portalComponentType = 'layout';
        const region = document.createElement('section');
        region.dataset.portalRegion = 'left';
        layout.appendChild(region);
        document.body.appendChild(layout);

        const records = {
            '/main/0': createRecord('/main/0', layout, 'layout', '/main'),
            '/main/0/left': createRecord('/main/0/left', region, 'region', '/main/0'),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([region]);

        const stop = initContextWindowDrag(pair.editor);
        pair.host.post('create-or-destroy-draggable', {kind: 'layout', create: true});
        pair.host.post('set-draggable-visible', {kind: 'layout', visible: true});

        document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientX: 14, clientY: 18}));

        expect($dragState.get()).toMatchObject({
            itemType: 'layout',
            targetPath: '/main/0/left',
            dropAllowed: false,
        });

        document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: 14, clientY: 18}));

        expect(calls('add-component-requested')).toHaveLength(0);
        expect(calls('drag-dropped')).toHaveLength(0);
        expect(calls('drag-canceled')).toHaveLength(1);
        expect(calls('drag-stopped')).toHaveLength(1);
        expect($dragState.get()).toBeUndefined();

        stop();
    });

    it('hides the drag chrome when the pointer leaves the iframe and cancels on destroy', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        document.body.appendChild(region);

        const records = {
            '/main': createRecord('/main', region, 'region', ComponentPath.root().toString()),
        };

        setRegistry(records);
        rebuildIndex(records);
        vi.mocked(document.elementsFromPoint).mockReturnValue([region]);

        const stop = initContextWindowDrag(pair.editor);
        pair.host.post('create-or-destroy-draggable', {kind: 'part', create: true});
        pair.host.post('set-draggable-visible', {kind: 'part', visible: true});

        document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientX: 40, clientY: 40}));
        expect($dragState.get()).toBeDefined();

        pair.host.post('set-draggable-visible', {kind: 'part', visible: false});

        expect($dragState.get()).toBeUndefined();
        expect(calls('drag-canceled')).toHaveLength(0);
        expect(calls('drag-stopped')).toHaveLength(0);

        pair.host.post('create-or-destroy-draggable', {kind: 'part', create: false});

        expect(calls('drag-canceled')).toHaveLength(1);
        expect(calls('drag-stopped')).toHaveLength(1);

        stop();
    });
});
