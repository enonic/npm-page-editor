import {describe, expect, it} from '@voidzero-dev/vite-plus-test';

import {getComponentInfoAt, getDescriptorAt, getFragmentIdAt, getTextAt, hasController, type PageJson} from './page';

const page: PageJson = {
    controller: 'com.example.app:default',
    regions: [
        {
            name: 'main',
            components: [
                {PartComponent: {name: 'My part', descriptor: 'com.example.app:my-part'}},
                {
                    LayoutComponent: {
                        name: 'Two columns',
                        descriptor: 'com.example.app:two-col',
                        regions: [
                            {name: 'left', components: [{TextComponent: {name: 'Text', text: '<p>Hello</p>'}}]},
                            {
                                name: 'right',
                                components: [{FragmentComponent: {name: 'Fragment', fragment: 'fragment-id-1'}}],
                            },
                        ],
                    },
                },
            ],
        },
    ],
};

describe('getComponentInfoAt', () => {
    it('resolves top-level components', () => {
        expect(getComponentInfoAt(page, '/main/0')).toMatchObject({
            kind: 'part',
            descriptor: 'com.example.app:my-part',
        });
        expect(getComponentInfoAt(page, '/main/1')).toMatchObject({kind: 'layout', name: 'Two columns'});
    });

    it('resolves components nested in layout regions', () => {
        expect(getTextAt(page, '/main/1/left/0')).toBe('<p>Hello</p>');
        expect(getFragmentIdAt(page, '/main/1/right/0')).toBe('fragment-id-1');
    });

    it('returns undefined for unknown paths', () => {
        expect(getComponentInfoAt(page, '/main/9')).toBeUndefined();
        expect(getComponentInfoAt(page, '/other/0')).toBeUndefined();
        expect(getComponentInfoAt(page, '/main/0/inner/0')).toBeUndefined();
        expect(getComponentInfoAt(undefined, '/main/0')).toBeUndefined();
    });

    it('resolves the fragment root at the root path', () => {
        const fragmentPage: PageJson = {fragment: {TextComponent: {name: 'Text', text: '<p>Fragment</p>'}}};

        expect(getComponentInfoAt(fragmentPage, '/')).toMatchObject({kind: 'text', text: '<p>Fragment</p>'});
        expect(getComponentInfoAt(page, '/')).toBeUndefined();
    });

    it('resolves components nested in a layout-rooted fragment', () => {
        const layoutFragmentPage: PageJson = {
            fragment: {
                LayoutComponent: {
                    name: 'Two columns',
                    descriptor: 'com.example.app:two-col',
                    regions: [
                        {
                            name: 'content',
                            components: [{PartComponent: {name: 'Inner', descriptor: 'com.example.app:inner'}}],
                        },
                    ],
                },
            },
        };

        expect(getComponentInfoAt(layoutFragmentPage, '/content/0')).toMatchObject({
            kind: 'part',
            descriptor: 'com.example.app:inner',
        });
        expect(getDescriptorAt(layoutFragmentPage, '/content/0')).toBe('com.example.app:inner');
    });
});

describe('hasController', () => {
    it('detects controller, template, and fragment pages', () => {
        expect(hasController(page)).toBe(true);
        expect(hasController({template: 'my-template'})).toBe(true);
        expect(hasController({fragment: {TextComponent: {text: ''}}})).toBe(true);
        expect(hasController({})).toBe(false);
        expect(hasController(undefined)).toBe(false);
    });
});
