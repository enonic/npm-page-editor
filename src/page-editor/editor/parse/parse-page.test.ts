import {ComponentPath} from '../../protocol';
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

    it('treats the fragment root component as the registry root path', () => {
        document.body.innerHTML = `
            <main>
                <div class="wrapper">
                    <section data-portal-component-type="layout">
                        <div data-portal-region="content">
                            <article data-portal-component-type="part"></article>
                        </div>
                    </section>
                </div>
            </main>
        `;

        const records = parsePage(document.body, {isFragment: true});

        expect(records[ComponentPath.root().toString()]).toMatchObject({
            type: 'layout',
            parentPath: undefined,
            children: ['/content'],
        });
        expect(records['/content']).toMatchObject({
            type: 'region',
            parentPath: '/',
            children: ['/content/0'],
        });
        expect(records['/content/0']).toMatchObject({
            type: 'part',
            parentPath: '/content',
        });
    });

    it('strips tracking attributes from an embedded fragment so it is one opaque unit', () => {
        document.body.innerHTML = `
            <section data-portal-region="main">
                <div data-portal-component-type="fragment">
                    <section data-portal-component-type="layout">
                        <div data-portal-region="left"><article data-portal-component-type="part">x</article></div>
                    </section>
                </div>
                <article data-portal-component-type="part">below</article>
            </section>
        `;

        const records = parsePage(document.body);

        // The fragment is tracked, but none of its descendants are.
        expect(records['/main/0']).toMatchObject({type: 'fragment', children: []});
        expect(records['/main/1']).toMatchObject({type: 'part'});
        expect(Object.keys(records).filter(path => path.startsWith('/main/0/'))).toEqual([]);

        const fragment = document.querySelector('[data-portal-component-type="fragment"]') as HTMLElement;
        expect(fragment.querySelector('[data-portal-component-type]')).toBeNull();
        expect(fragment.querySelector('[data-portal-region]')).toBeNull();
    });
});
