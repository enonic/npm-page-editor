const pagePlaceholderMocks = vi.hoisted(() => ({
    loadPagePlaceholderState: vi.fn(),
    selectedKeys: [] as string[],
    getCurrentPageView: vi.fn(),
}));

vi.mock('../../page-placeholder/load-page-placeholder', () => ({
    loadPagePlaceholderState: pagePlaceholderMocks.loadPagePlaceholderState,
}));

vi.mock('@enonic/lib-contentstudio/page-editor/event/outgoing/manipulation/SelectPageDescriptorEvent', () => ({
    SelectPageDescriptorEvent: class {
        private readonly key: string;

        constructor(key: string) {
            this.key = key;
        }

        fire(): void {
            pagePlaceholderMocks.selectedKeys.push(this.key);
        }
    },
}));

vi.mock('../../bridge', () => ({
    getCurrentPageView: pagePlaceholderMocks.getCurrentPageView,
}));

import {render} from 'preact';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {setModifyAllowed, setRegistry} from '../../stores/registry';
import type {ComponentRecord} from '../../types';
import {PagePlaceholderOverlay} from './PagePlaceholderOverlay';

function makeRootRecord(type: ComponentRecord['type'], empty: boolean): ComponentRecord {
    return {
        path: ComponentPath.root(),
        type,
        element: document.body,
        parentPath: undefined,
        children: [],
        empty,
        error: false,
        descriptor: undefined,
        loading: false,
    };
}

async function flushEffects(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitFor(assertion: () => boolean, attempts = 20): Promise<void> {
    for (let index = 0; index < attempts; index += 1) {
        await flushEffects();

        if (assertion()) {
            return;
        }
    }

    throw new Error('Timed out waiting for condition');
}

describe('PagePlaceholderOverlay', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        pagePlaceholderMocks.loadPagePlaceholderState.mockReset();
        pagePlaceholderMocks.loadPagePlaceholderState.mockResolvedValue({
            loading: false,
            error: undefined,
            contentTypeDisplayName: 'Article',
            options: [],
        });
        pagePlaceholderMocks.selectedKeys.length = 0;
        pagePlaceholderMocks.getCurrentPageView.mockReset();
        pagePlaceholderMocks.getCurrentPageView.mockReturnValue({
            getLiveEditParams: () => ({
                contentId: 'content-id',
                contentType: 'com.example:article',
            }),
        });

        setModifyAllowed(true);
        setRegistry({
            '/': makeRootRecord('page', true),
        });
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        document.body.innerHTML = '';
        setRegistry({});
        setModifyAllowed(true);
    });

    it('loads controller options and fires the selection event from the new overlay UI', async () => {
        pagePlaceholderMocks.loadPagePlaceholderState.mockResolvedValue({
            loading: false,
            error: undefined,
            contentTypeDisplayName: 'Article',
            options: [
                {
                    key: 'app:landing',
                    displayName: 'Landing page',
                    description: 'Best for curated editorial landing pages.',
                },
                {
                    key: 'app:news',
                    displayName: 'News page',
                    description: 'Renders article content with the news application.',
                },
            ],
        });

        render(<PagePlaceholderOverlay />, container);
        await waitFor(() => pagePlaceholderMocks.loadPagePlaceholderState.mock.calls.length === 1);
        await waitFor(() => container.textContent?.includes('Select a controller') ?? false);

        const select = container.querySelector('select') as HTMLSelectElement;

        expect(container.textContent).toContain('Select a controller');
        expect(container.textContent).toContain('No page template is assigned for Article');
        expect(select).not.toBeNull();
        expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
            'Choose a controller',
            'Landing page',
            'News page',
        ]);

        select.value = 'app:news';
        select.dispatchEvent(new Event('change', {bubbles: true}));
        await flushEffects();

        expect(pagePlaceholderMocks.selectedKeys).toEqual(['app:news']);
        expect(container.textContent).toContain('Renders article content with the news application.');
    });

    it('stays hidden when the root registry record is not an empty page shell', async () => {
        setRegistry({
            '/': makeRootRecord('part', true),
        });

        render(<PagePlaceholderOverlay />, container);
        await flushEffects();

        expect(container.innerHTML).toBe('');
    });
});
