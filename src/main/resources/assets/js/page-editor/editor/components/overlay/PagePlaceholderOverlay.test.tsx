const pagePlaceholderMocks = vi.hoisted(() => ({
    loadPagePlaceholderState: vi.fn(),
    getCurrentPageView: vi.fn(),
    i18n: vi.fn((key: string, ...args: unknown[]) => (args.length > 0 ? `${key}|${args.join(',')}` : key)),
}));

vi.mock('../../page-placeholder/load-page-placeholder', () => ({
    loadPagePlaceholderState: pagePlaceholderMocks.loadPagePlaceholderState,
}));

vi.mock('../../bridge', () => ({
    getCurrentPageView: pagePlaceholderMocks.getCurrentPageView,
}));

vi.mock('@enonic/lib-admin-ui/util/Messages', () => ({
    i18n: pagePlaceholderMocks.i18n,
}));

import {render} from 'preact';
import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import {setRegistry} from '../../stores/registry';
import type {ComponentRecord} from '../../types';
import {PagePlaceholderOverlay} from './PagePlaceholderOverlay';

function makeRootRecord(overrides: Partial<ComponentRecord> = {}): ComponentRecord {
    return {
        path: ComponentPath.root(),
        type: 'page',
        element: document.body,
        parentPath: undefined,
        children: [],
        empty: true,
        error: false,
        descriptor: undefined,
        loading: false,
        ...overrides,
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
            hasControllers: false,
            contentTypeDisplayName: undefined,
        });
        pagePlaceholderMocks.getCurrentPageView.mockReset();
        pagePlaceholderMocks.getCurrentPageView.mockReturnValue({
            getLiveEditParams: () => ({
                contentId: 'content-id',
                contentType: 'com.example:article',
            }),
        });

        setRegistry({'/': makeRootRecord()});
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        document.body.innerHTML = '';
        setRegistry({});
    });

    it('renders the legacy controller-available copy when descriptors load', async () => {
        pagePlaceholderMocks.loadPagePlaceholderState.mockResolvedValue({
            hasControllers: true,
            contentTypeDisplayName: 'Article',
        });

        render(<PagePlaceholderOverlay />, container);
        await waitFor(() => pagePlaceholderMocks.loadPagePlaceholderState.mock.calls.length === 1);
        await waitFor(() => container.textContent?.includes('text.selectcontroller') ?? false);

        expect(container.textContent).toContain('text.selectcontroller');
        expect(container.textContent).toContain('text.notemplates|Article');
        expect(container.querySelector('select')).toBeNull();
    });

    it('also surfaces when the root page reports a render error', async () => {
        setRegistry({'/': makeRootRecord({empty: false, error: true})});

        render(<PagePlaceholderOverlay />, container);
        await waitFor(() => pagePlaceholderMocks.loadPagePlaceholderState.mock.calls.length === 1);

        expect(container.textContent).toContain('text.nocontrollers');
    });

    it('stays hidden when the root registry record is not an empty page shell', async () => {
        setRegistry({'/': makeRootRecord({type: 'part', empty: true})});

        render(<PagePlaceholderOverlay />, container);
        await flushEffects();

        expect(container.innerHTML).toBe('');
    });
});
