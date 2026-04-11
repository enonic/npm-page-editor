vi.mock('@enonic/lib-contentstudio/app/wizard/page/PageState', () => ({
    PageState: {
        getComponentByPath: () => null,
    },
}));

import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {parsePage} from './parse-page';

describe('parsePage', () => {
    it('builds a path-first registry from nested regions and components', () => {
        document.body.innerHTML = `
            <main>
                <section data-portal-region="main">
                    <article data-portal-component-type="part"></article>
                    <div>
                        <section data-portal-component-type="layout">
                            <div data-portal-region="left">
                                <div data-portal-component-type="text">Body</div>
                            </div>
                        </section>
                    </div>
                </section>
            </main>
        `;

        const records = parsePage(document.body);

        expect(records[ComponentPath.root().toString()]).toMatchObject({
            type: 'page',
            children: ['/main'],
        });
        expect(records['/main']).toMatchObject({
            type: 'region',
            parentPath: '/',
            children: ['/main/0', '/main/1'],
            empty: false,
        });
        expect(records['/main/0']).toMatchObject({
            type: 'part',
            parentPath: '/main',
            children: [],
        });
        expect(records['/main/1']).toMatchObject({
            type: 'layout',
            parentPath: '/main',
            children: ['/main/1/left'],
        });
        expect(records['/main/1/left']).toMatchObject({
            type: 'region',
            parentPath: '/main/1',
            children: ['/main/1/left/0'],
        });
        expect(records['/main/1/left/0']).toMatchObject({
            type: 'text',
            parentPath: '/main/1/left',
            empty: false,
        });
    });
});
