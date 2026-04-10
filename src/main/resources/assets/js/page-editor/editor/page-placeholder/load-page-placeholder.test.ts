const loaderMocks = vi.hoisted(() => ({
    descriptors: [] as Array<{
        getKey(): {toString(): string};
        getDisplayName(): {toString(): string};
        getDescription(): {toString(): string};
        getName(): {toString(): string};
    }>,
    contentTypeDisplayName: 'Article',
}));

vi.mock('@enonic/lib-contentstudio/app/resource/GetComponentDescriptorsRequest', () => ({
    GetComponentDescriptorsRequest: class {
        setComponentType(): void {
            //
        }

        setContentId(): this {
            return this;
        }

        sendAndParse(): Promise<unknown> {
            return Promise.resolve(loaderMocks.descriptors);
        }
    },
}));

vi.mock('@enonic/lib-contentstudio/app/resource/GetContentTypeByNameRequest', () => ({
    GetContentTypeByNameRequest: class {
        sendAndParse(): Promise<{getTitle(): string}> {
            return Promise.resolve({
                getTitle: () => loaderMocks.contentTypeDisplayName,
            });
        }
    },
}));

import {loadPagePlaceholderState} from './load-page-placeholder';

function makeDescriptor(key: string, displayName: string, description: string) {
    return {
        getKey: () => ({toString: () => key}),
        getDisplayName: () => ({toString: () => displayName}),
        getDescription: () => ({toString: () => description}),
        getName: () => ({toString: () => displayName}),
    };
}

describe('loadPagePlaceholderState', () => {
    beforeEach(() => {
        loaderMocks.descriptors = [];
        loaderMocks.contentTypeDisplayName = 'Article';
    });

    it('maps and sorts page controller descriptors for the new placeholder UI', async () => {
        loaderMocks.descriptors = [
            makeDescriptor('app:news', 'News page', 'Renders article content with the news application.'),
            makeDescriptor('app:landing', 'Landing page', 'Best for curated editorial landing pages.'),
        ];

        const state = await loadPagePlaceholderState('content-id', 'com.example:article', false);

        expect(state).toMatchObject({
            loading: false,
            error: undefined,
            contentTypeDisplayName: 'Article',
        });
        expect(state.options.map((option) => option.displayName)).toEqual([
            'Landing page',
            'News page',
        ]);
        expect(state.options[1]).toMatchObject({
            key: 'app:news',
            description: 'Renders article content with the news application.',
        });
    });
});
