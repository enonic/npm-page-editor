import {PLACEHOLDER_HOST_ATTR} from '../constants';
import {$params, setParams} from '../stores/params';
import {
    $hoveredPath,
    $selectedPath,
    getRegistry,
    setDragState,
    setHoveredPath,
    setRegistry,
    setSelectedPath,
} from '../stores/registry';
import {destroyPlaceholders, initPlaceholderDragSync} from './placeholder-lifecycle';
import {markLoading, reconcilePage, reconcileSubtree, setPageRoot, shiftInteractionAfterRemoval} from './reconcile';

function setupPage(isFragment = false): void {
    if (isFragment) {
        setParams({contentId: 'test-content', isFragment: true});
    }

    setPageRoot(document.body);
}

describe('reconcilePage', () => {
    afterEach(() => {
        destroyPlaceholders();
        setRegistry({});
        setPageRoot(undefined);
        $params.set(undefined);
        document.body.innerHTML = '';
    });

    it('injects placeholder islands for empty regions and empty components', () => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <article data-portal-component-type="part"></article>
            </section>
            <section data-portal-region="aside"></section>
        `;

        setupPage();
        reconcilePage();

        expect(document.body.querySelectorAll(`[${PLACEHOLDER_HOST_ATTR}]`)).toHaveLength(2);
    });

    it('reconciles only the requested subtree and leaves sibling records intact', () => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <article data-portal-component-type="part"></article>
            </section>
            <section data-portal-region="aside"></section>
        `;

        setupPage();

        reconcilePage();

        const mainRecord = getRegistry()['/main'];
        const aside = document.querySelector('[data-portal-region="aside"]') as HTMLElement;
        aside.innerHTML = '<article data-portal-component-type="part"></article>';

        reconcileSubtree('/aside');

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
        setupPage();

        try {
            reconcilePage();

            const regionEl = document.querySelector('[data-portal-region="main"]') as HTMLElement;
            const countHosts = () =>
                Array.from(regionEl.children).filter(child => child.hasAttribute(PLACEHOLDER_HOST_ATTR)).length;
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
        setupPage();

        try {
            reconcilePage();

            const regionEl = document.querySelector('[data-portal-region="main"]') as HTMLElement;
            const countHosts = () =>
                Array.from(regionEl.children).filter(child => child.hasAttribute(PLACEHOLDER_HOST_ATTR)).length;

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
        setupPage();

        try {
            reconcilePage();

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
            const directHosts = Array.from(regionEl.children).filter(child =>
                child.hasAttribute(PLACEHOLDER_HOST_ATTR),
            );
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

        setupPage();
        reconcilePage();

        const partEl = document.querySelector('article[data-portal-component-type="part"]') as HTMLElement;
        expect(getRegistry()['/main/0'].empty).toBe(false);

        markLoading('/main/0', true);

        const overlay = partEl.querySelector<HTMLElement>(`[${PLACEHOLDER_HOST_ATTR}="overlay"]`);
        expect(overlay).not.toBeNull();
        expect(overlay?.style.position).toBe('absolute');
        expect(overlay?.style.inset).toBe('0px');
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

        setupPage();
        reconcilePage();
        expect(getRegistry()['/main/0'].empty).toBe(true);

        markLoading('/main/0', true);

        const partEl = document.querySelector('article[data-portal-component-type="part"]') as HTMLElement;
        const host = partEl.querySelector<HTMLElement>(`[${PLACEHOLDER_HOST_ATTR}]`);
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

        setupPage(true);
        reconcilePage();

        expect(getRegistry()['/']).toMatchObject({
            type: 'text',
            parentPath: undefined,
            empty: true,
        });
        expect(document.body.querySelectorAll(`[${PLACEHOLDER_HOST_ATTR}]`)).toHaveLength(1);
    });
});

describe('shiftInteractionAfterRemoval', () => {
    afterEach(() => {
        setSelectedPath(undefined);
        setHoveredPath(undefined);
    });

    it('shifts a later sibling selection down to track the same component', () => {
        setSelectedPath('/main/3');

        shiftInteractionAfterRemoval('/main/1');

        expect($selectedPath.get()).toBe('/main/2');
    });

    it('shifts a later sibling hover, preserving the nested suffix', () => {
        setHoveredPath('/main/4/left/0');

        shiftInteractionAfterRemoval('/main/2');

        expect($hoveredPath.get()).toBe('/main/3/left/0');
    });

    it('leaves an earlier sibling untouched', () => {
        setSelectedPath('/main/0');

        shiftInteractionAfterRemoval('/main/3');

        expect($selectedPath.get()).toBe('/main/0');
    });

    it('ignores selection in a different region', () => {
        setSelectedPath('/aside/2');

        shiftInteractionAfterRemoval('/main/0');

        expect($selectedPath.get()).toBe('/aside/2');
    });
});
