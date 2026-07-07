import {createOverlayHost} from './overlay-host';
import {createPlaceholderIsland} from './placeholder-island';

describe('shadow rendering', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('mounts overlay chrome into a shared shadow root', () => {
        const overlay = createOverlayHost(<div data-testid='overlay-child'>Overlay</div>);

        expect(overlay.host.id).toBe('pe-overlay-host');
        expect(overlay.shadow.querySelector('style[data-page-editor-ui]')).not.toBeNull();
        expect(overlay.mount.textContent).toContain('Overlay');

        overlay.unmount();
        expect(document.getElementById('pe-overlay-host')).toBeNull();
    });

    it('mounts placeholders into isolated shadow islands', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const island = createPlaceholderIsland(container, <div data-testid='placeholder-child'>Placeholder</div>);

        expect(container.querySelector('[data-pe-placeholder-host]')).toBe(island.host);
        expect(island.shadow.querySelector('style[data-page-editor-ui]')).not.toBeNull();
        expect(island.shadow.textContent).toContain('Placeholder');

        // The host is a light-DOM child of the edited page — its margin/padding
        // are forced to 0 !important so host-page spacing rules cannot shift it.
        expect(island.host.style.getPropertyValue('margin')).toMatch(/^0(px)?$/);
        expect(island.host.style.getPropertyPriority('margin')).toBe('important');
        expect(island.host.style.getPropertyValue('padding')).toMatch(/^0(px)?$/);
        expect(island.host.style.getPropertyPriority('padding')).toBe('important');

        island.unmount();
        expect(container.querySelector('[data-pe-placeholder-host]')).toBeNull();
    });
});
