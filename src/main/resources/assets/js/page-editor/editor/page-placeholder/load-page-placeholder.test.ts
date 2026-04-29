const loaderMocks = vi.hoisted(() => ({
    descriptors: [] as Array<{getKey(): {toString(): string}}>,
    contentTypeDisplayName: 'Article',
    handleErrors: [] as unknown[],
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

vi.mock('@enonic/lib-admin-ui/DefaultErrorHandler', () => ({
    DefaultErrorHandler: {
        handle: (reason: unknown) => loaderMocks.handleErrors.push(reason),
    },
}));

import {loadPagePlaceholderState} from './load-page-placeholder';

function makeDescriptor(key: string) {
    return {
        getKey: () => ({toString: () => key}),
    };
}

describe('loadPagePlaceholderState', () => {
    beforeEach(() => {
        loaderMocks.descriptors = [];
        loaderMocks.contentTypeDisplayName = 'Article';
        loaderMocks.handleErrors = [];
    });

    it('reports the controller availability and resolved content type display name', async () => {
        loaderMocks.descriptors = [makeDescriptor('app:landing'), makeDescriptor('app:news')];

        const state = await loadPagePlaceholderState('content-id', 'com.example:article', false);

        expect(state).toEqual({
            hasControllers: true,
            contentTypeDisplayName: 'Article',
        });
    });

    it('reports no controllers and no content type display name when descriptor list is empty', async () => {
        const state = await loadPagePlaceholderState('content-id', 'com.example:article', false);

        expect(state).toEqual({
            hasControllers: false,
            contentTypeDisplayName: undefined,
        });
    });

    it('omits the content type display name lookup for page templates', async () => {
        loaderMocks.descriptors = [makeDescriptor('app:landing')];

        const state = await loadPagePlaceholderState('content-id', 'com.example:article', true);

        expect(state).toEqual({
            hasControllers: true,
            contentTypeDisplayName: undefined,
        });
    });
});
