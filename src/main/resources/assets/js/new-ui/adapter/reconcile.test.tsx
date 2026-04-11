vi.mock('@enonic/lib-contentstudio/app/wizard/page/PageState', () => ({
    PageState: {
        getComponentByPath: () => null,
    },
}));

import {destroyPlaceholders, reconcilePage} from './reconcile';
import {PLACEHOLDER_HOST_ATTR} from '../constants';
import {setRegistry} from '../stores/registry';

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
});
