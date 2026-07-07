import type {ComponentRecord} from '../../types';

import {DRAG_ANCHOR_ATTR} from '../../constants';
import {ensurePlaceholderAnchor} from './drop-positioning';

describe('ensurePlaceholderAnchor', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('inserts an anchor with margin/padding forced to 0 !important', () => {
        const regionEl = document.createElement('section');
        document.body.appendChild(regionEl);
        const regionRecord = {element: regionEl, children: []} as unknown as ComponentRecord;

        const anchor = ensurePlaceholderAnchor(undefined, regionRecord, 0);

        expect(anchor.getAttribute(DRAG_ANCHOR_ATTR)).toBe('true');
        expect(anchor.parentElement).toBe(regionEl);

        // Neutralizes the host page's child-spacing rules on the drag anchor.
        expect(anchor.style.getPropertyValue('margin')).toMatch(/^0(px)?$/);
        expect(anchor.style.getPropertyPriority('margin')).toBe('important');
        expect(anchor.style.getPropertyValue('padding')).toMatch(/^0(px)?$/);
        expect(anchor.style.getPropertyPriority('padding')).toBe('important');
    });
});
