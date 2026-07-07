import {setHostContext} from '../stores/host';
import {stripFragmentDescendants} from './fragment';

const FIXED_TIME = 1_700_000_000_000;
const PROJECT = 'myproject';

function createFragmentElement(innerHtml: string): HTMLElement {
    const fragment = document.createElement('div');
    fragment.dataset.portalComponentType = 'fragment';
    fragment.innerHTML = innerHtml;
    return fragment;
}

describe('stripFragmentDescendants', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_TIME);
        setHostContext({project: {name: PROJECT}});
    });

    afterEach(() => {
        vi.useRealTimers();
        setHostContext({});
    });

    it('strips tracking attributes from descendants but keeps the fragment tracked', () => {
        const fragment = createFragmentElement(
            '<section data-portal-region="main"><div data-portal-component-type="part"></div></section>',
        );

        stripFragmentDescendants(fragment);

        expect(fragment.dataset.portalComponentType).toBe('fragment');
        expect(fragment.querySelector('[data-portal-region]')).toBeNull();
        expect(fragment.querySelectorAll('[data-portal-component-type]')).toHaveLength(0);
    });

    it('prepares embedded text components before stripping their tracking attribute', () => {
        const fragment = createFragmentElement(
            '<section data-portal-region="main">' +
                '<div data-portal-component-type="text"><p><img src="image://img-123"></p></div>' +
                '</section>',
        );

        stripFragmentDescendants(fragment);

        const img = fragment.querySelector('img');
        expect(img?.getAttribute('src')).toBe(
            `/admin/rest-v2/cs/cms/${PROJECT}/content/content/image/img-123?ts=${FIXED_TIME}&size=768&scaleWidth=true`,
        );
        expect(img?.getAttribute('data-src')).toBe('image://img-123');
        expect(fragment.querySelector('[data-portal-component-type]')).toBeNull();
    });
});
