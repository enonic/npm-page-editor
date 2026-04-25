vi.mock('@enonic/lib-contentstudio/app/wizard/page/PageState', () => ({
    PageState: {
        getComponentByPath: () => null,
    },
}));

import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {parseSubtree} from './parse-subtree';

describe('parseSubtree', () => {
    it('parses only a region subtree without rebuilding the full page registry', () => {
        document.body.innerHTML = `
            <main>
                <section data-portal-region="main">
                    <article data-portal-component-type="part"></article>
                    <section data-portal-component-type="layout">
                        <div data-portal-region="left">
                            <div data-portal-component-type="text">Body</div>
                        </div>
                    </section>
                </section>
                <section data-portal-region="aside">
                    <article data-portal-component-type="part"></article>
                </section>
            </main>
        `;

        const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
        const records = parseSubtree(region, ComponentPath.fromString('/main'));

        expect(Object.keys(records)).toEqual(['/main/0', '/main/1/left/0', '/main/1/left', '/main/1', '/main']);
        expect(records['/main']).toMatchObject({
            type: 'region',
            children: ['/main/0', '/main/1'],
        });
        expect(records['/main/1']).toMatchObject({
            type: 'layout',
            children: ['/main/1/left'],
        });
    });

    it('parses a component subtree and preserves descendant paths', () => {
        document.body.innerHTML = `
            <main>
                <section data-portal-region="main">
                    <section data-portal-component-type="layout">
                        <div data-portal-region="left">
                            <div data-portal-component-type="text">Body</div>
                        </div>
                    </section>
                </section>
            </main>
        `;

        const component = document.querySelector('[data-portal-component-type="layout"]') as HTMLElement;
        const records = parseSubtree(component, ComponentPath.fromString('/main/0'));

        expect(records['/main/0']).toMatchObject({
            type: 'layout',
            children: ['/main/0/left'],
        });
        expect(records['/main/0/left/0']).toMatchObject({
            type: 'text',
            parentPath: '/main/0/left',
        });
        expect(records['/']).toBeUndefined();
    });
});
