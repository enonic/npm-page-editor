vi.mock('@enonic/lib-contentstudio/app/wizard/page/PageState', () => ({
    PageState: {
        getComponentByPath: () => null,
    },
}));

import {destroyPlaceholders, reconcilePage, reconcileSubtree} from './reconcile';
import {PLACEHOLDER_HOST_ATTR} from '../constants';
import {getRegistry, setRegistry} from '../stores/registry';

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

        const pageView = {
            getHTMLElement: () => document.body,
        };

        reconcilePage(pageView as never);

        expect(document.body.querySelectorAll(`[${PLACEHOLDER_HOST_ATTR}]`)).toHaveLength(2);
    });

    it('reconciles only the requested subtree and leaves sibling records intact', () => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <article data-portal-component-type="part"></article>
            </section>
            <section data-portal-region="aside"></section>
        `;

        const pageView = {
            getHTMLElement: () => document.body,
        };

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
});
