/**
 * End-to-end DOM engine tests: real `registerBusHandlers` + real reconcile +
 * real DOM mutation, driven by a fake host bus. Asserts the observable effects:
 * element shape/position, registry records, and selection.
 */

import type {EditorToHostType} from '../../protocol';

import {createFakeBusPair, type FakeBusPair} from '../../../test/fake-bus';
import {registerBusHandlers} from '../adapter/bus-adapter';
import {destroyPlaceholders} from '../adapter/placeholder-lifecycle';
import {reconcilePage, setPageRoot} from '../adapter/reconcile';
import {setHostContext} from '../stores/host';
import {$params, setParams} from '../stores/params';
import {$selectedPath, getRecord, setSelectedPath} from '../stores/registry';
import {destroyTransport, getBus, initTransport} from '../transport/bus';

const flush = () =>
    new Promise<void>(resolve => {
        setTimeout(resolve, 0);
    });

// jsdom does not implement scrollIntoView; the engine calls it on post-mutation
// selection. Stub it so the deferred selection does not throw.
beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});

/** Inner HTML with editor-injected placeholder islands stripped. */
function renderedHtml(element: HTMLElement | undefined): string {
    if (!element) return '';
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-pe-placeholder-host]').forEach(host => host.remove());
    return clone.innerHTML.trim();
}

function selectPosts(posts: EditorToHostType[]): number {
    return posts.filter(type => type === 'component-selected').length;
}

describe('DOM engine via bus handlers', () => {
    let pair: FakeBusPair;
    let stop: () => void;
    let posted: EditorToHostType[];

    beforeEach(() => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <article data-portal-component-type="part">Part 0</article>
                <article data-portal-component-type="part">Part 1</article>
            </section>
            <section data-portal-region="aside"></section>
        `;

        setParams({contentId: 'c1'});
        setHostContext({project: {name: 'proj'}});
        setPageRoot(document.body);
        reconcilePage();

        pair = createFakeBusPair();
        posted = [];
        initTransport();
        vi.spyOn(getBus()!, 'post').mockImplementation(type => {
            posted.push(type);
        });

        stop = registerBusHandlers(pair.editor);
    });

    afterEach(() => {
        stop();
        destroyPlaceholders();
        pair.editor.destroy();
        pair.host.destroy();
        destroyTransport();
        setSelectedPath(undefined);
        setPageRoot(undefined);
        $params.set(undefined);
        setHostContext({});
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('add-component inserts an empty typed element at the index, registers it, and selects it', async () => {
        pair.host.post('add-component', {path: '/main/1', kind: 'text'});

        const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
        const types = Array.from(region.querySelectorAll('[data-portal-component-type]')).map(
            el => (el as HTMLElement).dataset.portalComponentType,
        );
        expect(types).toEqual(['part', 'text', 'part']);

        const inserted = getRecord('/main/1');
        expect(inserted?.type).toBe('text');
        expect(inserted?.empty).toBe(true);

        await flush();

        expect($selectedPath.get()).toBe('/main/1');
        expect(selectPosts(posted)).toBe(1);
    });

    it('remove-component removes the element, drops the record, and deselects when targeted', async () => {
        setSelectedPath('/main/0');

        pair.host.post('remove-component', {path: '/main/0'});

        expect(getRecord('/main/1')).toBeUndefined();
        expect(getRecord('/main/0')?.element?.textContent).toBe('Part 1');
        expect($selectedPath.get()).toBeUndefined();
        expect(posted).toContain('component-deselected');
    });

    it('move-component moves the element across regions, reparents the record, and remaps selection', async () => {
        setSelectedPath('/main/0');

        pair.host.post('move-component', {from: '/main/0', to: '/aside/0'});

        const aside = document.querySelector('[data-portal-region="aside"]') as HTMLElement;
        expect(aside.querySelector('[data-portal-component-type]')?.textContent).toBe('Part 0');
        expect(getRecord('/aside/0')?.element?.textContent).toBe('Part 0');

        // Selection is remapped to the new path and reasserted in the microtask.
        await flush();
        expect($selectedPath.get()).toBe('/aside/0');
        expect(selectPosts(posted)).toBe(1);
    });

    it('duplicate-component clones the source as the next sibling in an empty state and selects it', async () => {
        pair.host.post('duplicate-component', {path: '/main/1'});

        const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
        const components = region.querySelectorAll('[data-portal-component-type]');
        expect(components).toHaveLength(3);
        // The clone is inserted at index 1 (after the source at index 0), empty.
        expect(renderedHtml(components[1] as HTMLElement)).toBe('');

        const clone = getRecord('/main/1');
        expect(clone?.type).toBe('part');
        expect(clone?.empty).toBe(true);

        await flush();
        expect($selectedPath.get()).toBe('/main/1');
    });

    it('reset-component clears the element content and reparses it empty', () => {
        expect(getRecord('/main/0')?.empty).toBe(false);

        pair.host.post('reset-component', {path: '/main/0'});

        const part = getRecord('/main/0')?.element;
        expect(renderedHtml(part)).toBe('');
        expect(getRecord('/main/0')?.empty).toBe(true);
    });

    it('update-text-component sets the element HTML with converted image src and skips live origin', async () => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <div data-portal-component-type="text">old</div>
            </section>
        `;
        setPageRoot(document.body);
        reconcilePage();

        // A live-origin update is ignored (the iframe is the source of truth).

        pair.host.post('update-text-component', {path: '/main/0', text: '<p>x</p>', origin: 'live'});
        expect(getRecord('/main/0')?.element?.innerHTML).toBe('old');

        pair.host.post('update-text-component', {
            path: '/main/0',
            text: '<p><img src="image://img-1"></p>',
            origin: 'inspector',
        });

        const img = getRecord('/main/0')?.element?.querySelector('img');
        expect(img?.getAttribute('src')).toContain('/cms/proj/content/content/image/img-1?');
        expect(img?.getAttribute('data-src')).toBe('image://img-1');

        await flush();
    });
});
