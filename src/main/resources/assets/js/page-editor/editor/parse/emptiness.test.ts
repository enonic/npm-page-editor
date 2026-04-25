import {OVERLAY_HOST_ID, PLACEHOLDER_HOST_ATTR} from '../constants';
import {isNodeEmpty} from './emptiness';

describe('isNodeEmpty', () => {
    it('ignores editor-injected placeholder hosts', () => {
        const container = document.createElement('div');
        const host = document.createElement('div');
        host.setAttribute(PLACEHOLDER_HOST_ATTR, 'true');
        container.appendChild(host);

        expect(isNodeEmpty(container)).toBe(true);
    });

    it('ignores the shared overlay host', () => {
        const container = document.createElement('div');
        const overlay = document.createElement('div');
        overlay.id = OVERLAY_HOST_ID;
        container.appendChild(overlay);

        expect(isNodeEmpty(container)).toBe(true);
    });

    it('treats text content as non-empty', () => {
        const container = document.createElement('div');
        container.textContent = 'Hello';

        expect(isNodeEmpty(container)).toBe(false);
    });
});
