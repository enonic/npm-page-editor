/**
 * Pipeline tests for the load/render path: `renderComponentHtml` → DOM mutation
 * → reconcile → placeholders + element index. Drives the server-shaped HTML XP's
 * portal emits in edit mode (each component wrapped in its own
 * `data-portal-component-type` root) and asserts the observable behavior the
 * host relies on: a reset component shows its placeholder, and a reloaded
 * component (and everything around it) stays selectable.
 */

import {renderComponentHtml} from './componentRendering';
import {destroyPlaceholders} from './editor/adapter/placeholder-lifecycle';
import {reconcilePage, setPageRoot} from './editor/adapter/reconcile';
import {getTrackedTarget} from './editor/interaction/common/click-guard';
import {elementIndex} from './editor/stores/element-index';
import {setPage} from './editor/stores/page';
import {$params, setParams} from './editor/stores/params';
import {getRecord, setRegistry, setSelectedPath} from './editor/stores/registry';
import {ComponentPath} from './protocol';

/** Mirrors the selection hit-test: closest tracked ancestor → indexed path. */
function clickPath(target: HTMLElement): string | undefined {
    const tracked = getTrackedTarget(target);
    return tracked ? elementIndex.get(tracked) : undefined;
}

function renderPage(html: string): void {
    document.body.innerHTML = html;
    setParams({contentId: 'c1'});
    setPageRoot(document.body);
    reconcilePage();
}

afterEach(() => {
    destroyPlaceholders();
    setSelectedPath(undefined);
    setPageRoot(undefined);
    $params.set(undefined);
    setPage(undefined);
    setRegistry({});
    document.body.innerHTML = '';
});

describe('renderComponentHtml', () => {
    it('renders the empty-state placeholder when a part is reset', () => {
        renderPage(`
            <section data-portal-region="main">
                <aside data-portal-component-type="part" class="widget">orig</aside>
            </section>
        `);

        // A reset part comes back as the portal's empty typed wrapper.
        renderComponentHtml(ComponentPath.fromString('/main/0'), '<div data-portal-component-type="part"></div>');

        const part = getRecord('/main/0')?.element as HTMLElement;
        expect(part.querySelector('[data-portal-component-type]')).toBeNull();
        expect(getRecord('/main/0')?.empty).toBe(true);
        expect(part.querySelector('[data-pe-placeholder-host]')).not.toBeNull();
    });

    it('keeps a reloaded part selectable by clicking its content', () => {
        renderPage(`
            <section data-portal-region="main">
                <aside data-portal-component-type="part" class="widget">orig-0</aside>
                <article data-portal-component-type="part">orig-1</article>
            </section>
        `);

        renderComponentHtml(
            ComponentPath.fromString('/main/0'),
            '<aside data-portal-component-type="part" class="widget"><form><input></form></aside>',
        );

        const part = getRecord('/main/0')?.element as HTMLElement;
        expect(clickPath(part.querySelector('input') as HTMLElement)).toBe('/main/0');
        // The sibling below is unaffected.
        expect(clickPath(getRecord('/main/1')?.element as HTMLElement)).toBe('/main/1');
    });

    it("keeps a reloaded layout's nested part and the sibling below selectable", () => {
        renderPage(`
            <section data-portal-region="main">
                <div data-portal-component-type="layout"><div data-portal-region="left"><article data-portal-component-type="part">inner</article></div></div>
                <article data-portal-component-type="part">below</article>
            </section>
        `);

        renderComponentHtml(
            ComponentPath.fromString('/main/0'),
            '<div data-portal-component-type="layout"><div data-portal-region="left"><article data-portal-component-type="part">new-inner</article></div></div>',
        );

        const layout = getRecord('/main/0')?.element as HTMLElement;
        expect(layout.querySelector(':scope > [data-portal-component-type="layout"]')).toBeNull();
        const innerPart = layout.querySelector(
            '[data-portal-region="left"] [data-portal-component-type="part"]',
        ) as HTMLElement;
        expect(clickPath(innerPart)).toBe('/main/0/left/0');
        expect(clickPath(getRecord('/main/1')?.element as HTMLElement)).toBe('/main/1');
    });
});
