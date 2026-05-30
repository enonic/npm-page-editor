vi.mock('@enonic/lib-contentstudio/app/wizard/page/PageState', () => ({
    PageState: {
        getComponentByPath: () => null,
    },
}));

import {destroyPlaceholders, initPlaceholderDragSync} from './placeholder-lifecycle';
import {markLoading, reconcilePage, reconcileSubtree} from './reconcile';
import {PLACEHOLDER_HOST_ATTR} from '../constants';
import {getRegistry, setDragState, setRegistry} from '../stores/registry';

function createPageView(isFragment = false) {
    return {
        getHTMLElement: () => document.body,
        getLiveEditParams: () => ({isFragment}),
    };
}

describe('reconcilePage', () => {
    afterEach(() => {
        destroyPlaceholders();
        setRegistry({});
        document.body.innerHTML = '';
    });

    it('injects placeholder islands for empty regions and empty components', () => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <article data-portal-component-type="part"></article>
            </section>
            <section data-portal-region="aside"></section>
        `;

        reconcilePage(createPageView() as never);

        expect(document.body.querySelectorAll(`[${PLACEHOLDER_HOST_ATTR}]`)).toHaveLength(2);
    });

    it('reconciles only the requested subtree and leaves sibling records intact', () => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <article data-portal-component-type="part"></article>
            </section>
            <section data-portal-region="aside"></section>
        `;

        const pageView = createPageView();

        reconcilePage(pageView as never);

        const mainRecord = getRegistry()['/main'];
        const aside = document.querySelector('[data-portal-region="aside"]') as HTMLElement;
        aside.innerHTML = '<article data-portal-component-type="part"></article>';

        reconcileSubtree(pageView as never, '/aside');

        expect(getRegistry()['/main']).toBe(mainRecord);
        expect(getRegistry()['/aside']).toMatchObject({
            children: ['/aside/0'],
        });
        expect(getRegistry()['/aside/0']).toMatchObject({
            type: 'part',
        });
    });

    it('shows a region placeholder while the sole child is being dragged', () => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <article data-portal-component-type="part">Part 0</article>
            </section>
        `;

        const stopDragSync = initPlaceholderDragSync();
        const pageView = createPageView();

        try {
            reconcilePage(pageView as never);

            const regionEl = document.querySelector('[data-portal-region="main"]') as HTMLElement;
            const countHosts = () => Array.from(regionEl.children)
                .filter((child) => child.hasAttribute(PLACEHOLDER_HOST_ATTR))
                .length;
            expect(countHosts()).toBe(0);

            setDragState({
                itemType: 'part',
                itemLabel: 'Part',
                sourcePath: '/main/0',
                targetPath: undefined,
                dropAllowed: false,
                message: undefined,
                placeholderElement: undefined,
                x: undefined,
                y: undefined,
            });

            expect(countHosts()).toBe(1);

            setDragState(undefined);

            expect(countHosts()).toBe(0);
        } finally {
            stopDragSync();
            setDragState(undefined);
        }
    });

    it('destroys the region placeholder while the region is the active drop target', () => {
        document.body.innerHTML = `
            <section data-portal-region="main"></section>
        `;

        const stopDragSync = initPlaceholderDragSync();
        const pageView = createPageView();

        try {
            reconcilePage(pageView as never);

            const regionEl = document.querySelector('[data-portal-region="main"]') as HTMLElement;
            const countHosts = () => Array.from(regionEl.children)
                .filter((child) => child.hasAttribute(PLACEHOLDER_HOST_ATTR))
                .length;

            // Empty region shows its RegionPlaceholder island.
            expect(countHosts()).toBe(1);

            // Region becomes the active drop target — its placeholder host is
            // destroyed so it cannot stack above the drag placeholder.
            setDragState({
                itemType: 'part',
                itemLabel: 'Part',
                sourcePath: '/external',
                targetPath: '/main',
                dropAllowed: true,
                message: undefined,
                placeholderElement: undefined,
                x: undefined,
                y: undefined,
            });

            expect(countHosts()).toBe(0);

            // Target leaves the region — its placeholder host is restored.
            setDragState(undefined);

            expect(countHosts()).toBe(1);
        } finally {
            stopDragSync();
            setDragState(undefined);
        }
    });

    it('does not show a region placeholder when other children remain visible', () => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <article data-portal-component-type="part">Part 0</article>
                <article data-portal-component-type="part">Part 1</article>
            </section>
        `;

        const stopDragSync = initPlaceholderDragSync();
        const pageView = createPageView();

        try {
            reconcilePage(pageView as never);

            setDragState({
                itemType: 'part',
                itemLabel: 'Part',
                sourcePath: '/main/0',
                targetPath: undefined,
                dropAllowed: false,
                message: undefined,
                placeholderElement: undefined,
                x: undefined,
                y: undefined,
            });

            const regionEl = document.querySelector('[data-portal-region="main"]') as HTMLElement;
            const directHosts = Array.from(regionEl.children)
                .filter((child) => child.hasAttribute(PLACEHOLDER_HOST_ATTR));
            expect(directHosts).toHaveLength(0);
        } finally {
            stopDragSync();
            setDragState(undefined);
        }
    });

    it('shows a loading overlay above a non-empty part while it is reloading', () => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <article data-portal-component-type="part">
                    <h1>Title</h1>
                    <p>Body</p>
                </article>
            </section>
        `;

        reconcilePage(createPageView() as never);

        const partEl = document.querySelector('article[data-portal-component-type="part"]') as HTMLElement;
        expect(getRegistry()['/main/0'].empty).toBe(false);

        markLoading('/main/0', true);

        const overlay = partEl.querySelector(`[${PLACEHOLDER_HOST_ATTR}="overlay"]`) as HTMLElement | null;
        expect(overlay).not.toBeNull();
        expect(overlay?.style.position).toBe('absolute');
        expect(overlay?.style.inset).toBe('0');
        expect(partEl.style.position).toBe('relative');

        markLoading('/main/0', false);

        expect(partEl.querySelector(`[${PLACEHOLDER_HOST_ATTR}]`)).toBeNull();
        expect(partEl.style.position).toBe('');
    });

    it('still shows a full-block loading placeholder while an empty part is loading', () => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <article data-portal-component-type="part"></article>
            </section>
        `;

        reconcilePage(createPageView() as never);
        expect(getRegistry()['/main/0'].empty).toBe(true);

        markLoading('/main/0', true);

        const partEl = document.querySelector('article[data-portal-component-type="part"]') as HTMLElement;
        const host = partEl.querySelector(`[${PLACEHOLDER_HOST_ATTR}]`) as HTMLElement | null;
        expect(host).not.toBeNull();
        expect(host?.getAttribute(PLACEHOLDER_HOST_ATTR)).toBe('true');
        expect(host?.style.position).toBe('');
    });

    it('reconciles fragment pages against the root component path', () => {
        document.body.innerHTML = `
            <div class="outer">
                <article data-portal-component-type="text"></article>
            </div>
        `;

        reconcilePage(createPageView(true) as never);

        expect(getRegistry()['/']).toMatchObject({
            type: 'text',
            parentPath: undefined,
            empty: true,
        });
        expect(document.body.querySelectorAll(`[${PLACEHOLDER_HOST_ATTR}]`)).toHaveLength(1);
    });
});
