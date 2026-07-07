import type {ComponentRecord} from '../types';

import {ComponentPath} from '../../protocol';
import {setHostContext} from '../stores/host';
import {setParams} from '../stores/params';
import {setRegistry} from '../stores/registry';
import {prepareTextComponent, prepareTextComponents} from './text-component';

const FIXED_TIME = 1_700_000_000_000;
const PROJECT = 'myproject';

function previewSrc(id: string): string {
    return `/admin/rest-v2/cs/cms/${PROJECT}/content/content/image/${id}?ts=${FIXED_TIME}&size=768&scaleWidth=true`;
}

function makeElement(type: string, html = ''): HTMLElement {
    const el = document.createElement('div');
    el.dataset.portalComponentType = type;
    el.innerHTML = html;
    return el;
}

function record(path: string, type: ComponentRecord['type'], element: HTMLElement): ComponentRecord {
    return {
        path: ComponentPath.fromString(path),
        type,
        element,
        parentPath: '/main',
        children: [],
        empty: false,
        error: false,
        descriptor: undefined,
        loading: false,
    };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIME);
    setHostContext({project: {name: PROJECT}});
    setParams({contentId: 'c1'});
});

afterEach(() => {
    vi.useRealTimers();
    setHostContext({});
    setRegistry({});
});

describe('prepareTextComponent', () => {
    it('sets dir="rtl" when the editing language is right-to-left', () => {
        setParams({contentId: 'c1', language: 'ar'});
        const element = makeElement('text');

        prepareTextComponent(element);

        expect(element.getAttribute('dir')).toBe('rtl');
    });

    it('leaves dir unset for left-to-right languages', () => {
        setParams({contentId: 'c1', language: 'en'});
        const element = makeElement('text');

        prepareTextComponent(element);

        expect(element.hasAttribute('dir')).toBe(false);
    });

    it('removes a stale dir attribute when the language is left-to-right', () => {
        setParams({contentId: 'c1', language: 'en'});
        const element = makeElement('text');
        element.setAttribute('dir', 'rtl');

        prepareTextComponent(element);

        expect(element.hasAttribute('dir')).toBe(false);
    });

    it('rewrites image render URLs in the rendered HTML to preview URLs', () => {
        setParams({contentId: 'c1', language: 'en'});
        const element = makeElement('text', '<p><img src="image://img-123"></p>');

        prepareTextComponent(element);

        const img = element.querySelector('img');
        expect(img?.getAttribute('src')).toBe(previewSrc('img-123'));
        expect(img?.getAttribute('data-src')).toBe('image://img-123');
    });

    it('leaves rendered HTML without render URLs untouched', () => {
        setParams({contentId: 'c1', language: 'en'});
        const element = makeElement('text', '<p>Hello <strong>world</strong></p>');

        prepareTextComponent(element);

        expect(element.innerHTML).toBe('<p>Hello <strong>world</strong></p>');
    });
});

describe('prepareTextComponents', () => {
    it('prepares every text component in the registry and skips other kinds', () => {
        setParams({contentId: 'c1', language: 'ar'});
        const textEl = makeElement('text', '<img src="image://text-img">');
        const partEl = makeElement('part', '<img src="image://part-img">');

        setRegistry({
            '/main/0': record('/main/0', 'text', textEl),
            '/main/1': record('/main/1', 'part', partEl),
        });

        prepareTextComponents();

        expect(textEl.getAttribute('dir')).toBe('rtl');
        expect(textEl.querySelector('img')?.getAttribute('src')).toBe(previewSrc('text-img'));

        expect(partEl.hasAttribute('dir')).toBe(false);
        expect(partEl.querySelector('img')?.getAttribute('src')).toBe('image://part-img');
    });
});
