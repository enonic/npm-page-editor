import type {ComponentRecord} from '../types';

import {ComponentPath} from '../../protocol';
import {setHostContext} from '../stores/host';
import {setParams} from '../stores/params';
import {setRegistry} from '../stores/registry';
import {
    addComponentElement,
    duplicateComponentElement,
    elementContainsLayout,
    moveComponentElement,
    removeComponentElement,
    replaceComponentHtml,
    resetComponentElement,
    setTextComponentHtml,
} from './mutate';

function record(
    path: string,
    type: ComponentRecord['type'],
    element: HTMLElement,
    parentPath?: string,
): ComponentRecord {
    return {
        path: path === '/' ? ComponentPath.root() : ComponentPath.fromString(path),
        type,
        element,
        parentPath,
        children: [],
        empty: false,
        error: false,
        descriptor: undefined,
        loading: false,
    };
}

function makeComponent(type: string, tag = 'div'): HTMLElement {
    const el = document.createElement(tag);
    el.dataset.portalComponentType = type;
    return el;
}

function trackedChildTypes(region: HTMLElement): string[] {
    return Array.from(region.children)
        .filter(
            (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.portalComponentType != null,
        )
        .map(child => child.dataset.portalComponentType ?? '');
}

afterEach(() => {
    document.body.innerHTML = '';
    setRegistry({});
    setHostContext({});
});

describe('addComponentElement', () => {
    it('inserts an empty typed div at the path index inside the parent region', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const first = makeComponent('part');
        const second = makeComponent('part');
        region.append(first, second);
        document.body.appendChild(region);

        setRegistry({
            '/main': record('/main', 'region', region, '/'),
            '/main/0': record('/main/0', 'part', first, '/main'),
            '/main/1': record('/main/1', 'part', second, '/main'),
        });

        const inserted = addComponentElement(ComponentPath.fromString('/main/1'), 'text');

        expect(inserted?.tagName).toBe('DIV');
        expect(inserted?.dataset.portalComponentType).toBe('text');
        expect(inserted?.innerHTML).toBe('');
        // Inserted before the old index-1 component → order is part, text, part.
        expect(trackedChildTypes(region)).toEqual(['part', 'text', 'part']);
    });

    it('appends after the last tracked component when the index is past the end', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const first = makeComponent('part');
        region.append(first);
        document.body.appendChild(region);

        setRegistry({
            '/main': record('/main', 'region', region, '/'),
            '/main/0': record('/main/0', 'part', first, '/main'),
        });

        addComponentElement(ComponentPath.fromString('/main/1'), 'layout');

        expect(trackedChildTypes(region)).toEqual(['part', 'layout']);
    });

    it('appends into an empty region', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        document.body.appendChild(region);

        setRegistry({'/main': record('/main', 'region', region, '/')});

        addComponentElement(ComponentPath.fromString('/main/0'), 'part');

        expect(trackedChildTypes(region)).toEqual(['part']);
    });

    it('inserts as a direct region child when the reference component is inside a wrapper', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const wrapper = document.createElement('div');
        const wrapped = makeComponent('layout');
        wrapper.appendChild(wrapped);
        region.appendChild(wrapper);
        document.body.appendChild(region);

        setRegistry({
            '/main': record('/main', 'region', region, '/'),
            '/main/0': record('/main/0', 'layout', wrapped, '/main'),
        });

        const inserted = addComponentElement(ComponentPath.fromString('/main/0'), 'text');

        // Must be a direct child of the region, not buried inside the server wrapper.
        expect(inserted?.parentElement).toBe(region);
        expect(wrapper.contains(inserted ?? null)).toBe(false);
        // Document order among tracked components is preserved: text before the wrapped layout.
        const orderedTypes = Array.from(region.querySelectorAll('[data-portal-component-type]')).map(el =>
            el instanceof HTMLElement ? el.dataset.portalComponentType : undefined,
        );
        expect(orderedTypes).toEqual(['text', 'layout']);
    });

    it('appends as a direct region child past a wrapped last component', () => {
        const region = document.createElement('section');
        region.dataset.portalRegion = 'main';
        const wrapper = document.createElement('div');
        const wrapped = makeComponent('part');
        wrapper.appendChild(wrapped);
        region.appendChild(wrapper);
        document.body.appendChild(region);

        setRegistry({
            '/main': record('/main', 'region', region, '/'),
            '/main/0': record('/main/0', 'part', wrapped, '/main'),
        });

        const inserted = addComponentElement(ComponentPath.fromString('/main/1'), 'text');

        expect(inserted?.parentElement).toBe(region);
        expect(region.lastElementChild).toBe(inserted);
    });
});

describe('removeComponentElement', () => {
    it('removes the component element from the DOM', () => {
        const region = document.createElement('section');
        const part = makeComponent('part');
        region.appendChild(part);
        document.body.appendChild(region);

        setRegistry({'/main/0': record('/main/0', 'part', part, '/main')});

        removeComponentElement('/main/0');

        expect(part.isConnected).toBe(false);
    });
});

describe('moveComponentElement', () => {
    it('moves a component element into the target region at the given index', () => {
        const main = document.createElement('section');
        main.dataset.portalRegion = 'main';
        const aside = document.createElement('section');
        aside.dataset.portalRegion = 'aside';
        const moving = makeComponent('part');
        const asideFirst = makeComponent('part');
        main.append(moving);
        aside.append(asideFirst);
        document.body.append(main, aside);

        setRegistry({
            '/main': record('/main', 'region', main, '/'),
            '/main/0': record('/main/0', 'part', moving, '/main'),
            '/aside': record('/aside', 'region', aside, '/'),
            '/aside/0': record('/aside/0', 'part', asideFirst, '/aside'),
        });

        moveComponentElement('/main/0', '/aside/0');

        expect(trackedChildTypes(main)).toEqual([]);
        // Inserted before the existing aside child → moving part is first.
        expect(Array.from(aside.children)).toEqual([moving, asideFirst]);
    });
});

describe('duplicateComponentElement', () => {
    it('clones the source as the next sibling in an empty state', () => {
        const region = document.createElement('section');
        const source = makeComponent('part', 'article');
        source.innerHTML = '<h1>Original</h1>';
        region.appendChild(source);
        document.body.appendChild(region);

        setRegistry({'/main/0': record('/main/0', 'part', source, '/main')});

        const clone = duplicateComponentElement('/main/0');

        expect(clone?.tagName).toBe('ARTICLE');
        expect(clone?.dataset.portalComponentType).toBe('part');
        expect(clone?.innerHTML).toBe('');
        expect(source.nextElementSibling).toBe(clone);
    });
});

describe('resetComponentElement', () => {
    it('clears the rendered content and the error attribute', () => {
        const part = makeComponent('part');
        part.innerHTML = '<p>content</p>';
        part.setAttribute('data-portal-placeholder-error', 'true');
        document.body.appendChild(part);

        setRegistry({'/main/0': record('/main/0', 'part', part, '/main')});

        resetComponentElement('/main/0');

        expect(part.innerHTML).toBe('');
        expect(part.hasAttribute('data-portal-placeholder-error')).toBe(false);
        expect(part.dataset.portalComponentType).toBe('part');
    });
});

describe('setTextComponentHtml', () => {
    it('sets the inner HTML, rewriting image render URLs for preview', () => {
        setHostContext({project: {name: 'proj'}});
        const text = makeComponent('text');
        document.body.appendChild(text);

        setRegistry({'/main/0': record('/main/0', 'text', text, '/main')});

        setTextComponentHtml('/main/0', '<p><img src="image://img-1"></p>');

        const img = text.querySelector('img');
        expect(img?.getAttribute('src')).toContain('/cms/proj/content/content/image/img-1?');
        expect(img?.getAttribute('data-src')).toBe('image://img-1');
    });

    it('clears the element for blank text', () => {
        const text = makeComponent('text');
        text.innerHTML = '<p>old</p>';
        document.body.appendChild(text);

        setRegistry({'/main/0': record('/main/0', 'text', text, '/main')});

        setTextComponentHtml('/main/0', '   ');

        expect(text.innerHTML).toBe('');
    });
});

describe('replaceComponentHtml', () => {
    it("replaces a component's inner HTML in place", () => {
        const part = makeComponent('part');
        document.body.appendChild(part);

        setRegistry({'/main/0': record('/main/0', 'part', part, '/main')});

        const ok = replaceComponentHtml('/main/0', '<h1>Rendered</h1>');

        expect(ok).toBe(true);
        expect(part.innerHTML).toBe('<h1>Rendered</h1>');
        expect(part.dataset.portalComponentType).toBe('part');
    });

    it('unwraps a same-type rendered wrapper instead of nesting it', () => {
        const part = makeComponent('part', 'aside');
        part.className = 'stale';
        document.body.appendChild(part);

        setRegistry({'/main/0': record('/main/0', 'part', part, '/main')});

        // The portal renders the part inside its own data-portal-component-type
        // root; adopt it in place rather than nesting a duplicate wrapper.
        replaceComponentHtml(
            '/main/0',
            '<aside data-portal-component-type="part" class="widget"><form><input></form></aside>',
        );

        expect(part.querySelector('[data-portal-component-type]')).toBeNull();
        expect(part.classList.contains('widget')).toBe(true);
        expect(part.classList.contains('stale')).toBe(false);
        expect(part.querySelector('input')).not.toBeNull();
    });

    it('empties the element when the rendered wrapper is empty (reset)', () => {
        const part = makeComponent('part', 'aside');
        part.innerHTML = '<form>old</form>';
        document.body.appendChild(part);

        setRegistry({'/main/0': record('/main/0', 'part', part, '/main')});

        replaceComponentHtml('/main/0', '<div data-portal-component-type="part"></div>');

        expect(part.children).toHaveLength(0);
        expect(part.innerHTML).toBe('');
    });

    it('strips nested tracking attributes inside a rendered fragment', () => {
        const fragment = makeComponent('fragment');
        document.body.appendChild(fragment);

        setRegistry({'/main/0': record('/main/0', 'fragment', fragment, '/main')});

        replaceComponentHtml(
            '/main/0',
            '<div data-portal-component-type="layout"><section data-portal-region="inner"></section></div>',
        );

        expect(fragment.querySelector('[data-portal-component-type]')).toBeNull();
        expect(fragment.querySelector('[data-portal-region]')).toBeNull();
        expect(elementContainsLayout(fragment)).toBe(true);
    });

    it('returns false when no element is registered for the path', () => {
        expect(replaceComponentHtml('/missing', '<p>x</p>')).toBe(false);
    });
});

describe('replaceComponentHtml text preparation', () => {
    const FIXED_TIME = 1_700_000_000_000;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_TIME);
        setHostContext({project: {name: 'myproject'}});
        setParams({contentId: 'c1', language: 'ar'});
    });

    afterEach(() => {
        vi.useRealTimers();
        setParams({contentId: 'c1'});
    });

    it('rewrites image render URLs and applies RTL direction when a text component reloads', () => {
        const text = makeComponent('text');
        document.body.appendChild(text);
        setRegistry({'/main/0': record('/main/0', 'text', text, '/main')});

        replaceComponentHtml('/main/0', '<div data-portal-component-type="text"><p><img src="image://abc"></p></div>');

        const img = text.querySelector('img');
        expect(img?.getAttribute('src')).toBe(
            `/admin/rest-v2/cs/cms/myproject/content/content/image/abc?ts=${FIXED_TIME}&size=768&scaleWidth=true`,
        );
        expect(img?.getAttribute('data-src')).toBe('image://abc');
        expect(text.getAttribute('dir')).toBe('rtl');
    });
});

describe('elementContainsLayout', () => {
    it('detects a layout descendant in an inline-rendered fragment', () => {
        const fragment = makeComponent('fragment');
        fragment.innerHTML = '<div data-portal-component-type="layout"></div>';

        expect(elementContainsLayout(fragment)).toBe(true);
    });

    it('returns false for a fragment without a layout', () => {
        const fragment = makeComponent('fragment');
        fragment.innerHTML = '<div data-portal-component-type="part"></div>';

        expect(elementContainsLayout(fragment)).toBe(false);
    });

    it('returns false for an undefined element', () => {
        expect(elementContainsLayout(undefined)).toBe(false);
    });
});
