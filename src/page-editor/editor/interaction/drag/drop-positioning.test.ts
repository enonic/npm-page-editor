import type {ComponentRecord} from '../../types';

import {ComponentPath} from '../../../protocol';
import {DRAG_ANCHOR_ATTR} from '../../constants';
import {setRegistry} from '../../stores/registry';
import {ensurePlaceholderAnchor, inferAxis} from './drop-positioning';

function setRect(
    element: HTMLElement,
    {top, left, width, height}: {top: number; left: number; width: number; height: number},
): void {
    Object.defineProperty(element, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
            top,
            left,
            width,
            height,
            right: left + width,
            bottom: top + height,
            x: left,
            y: top,
            toJSON: () => undefined,
        }),
    });
}

function createChildRecord(element: HTMLElement): ComponentRecord {
    return {element} as unknown as ComponentRecord;
}

describe('ensurePlaceholderAnchor', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        setRegistry({});
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

    it('inserts the anchor beside a component wrapped in non-tracked markup', () => {
        const regionEl = document.createElement('section');
        const wrapper = document.createElement('div');
        const component = document.createElement('article');
        component.dataset.portalComponentType = 'part';
        wrapper.appendChild(component);
        regionEl.appendChild(wrapper);
        document.body.appendChild(regionEl);

        const records: Record<string, ComponentRecord> = {
            '/main': {
                path: ComponentPath.fromString('/main'),
                type: 'region',
                element: regionEl,
                parentPath: ComponentPath.root().toString(),
                children: ['/main/0'],
                empty: false,
                error: false,
                descriptor: undefined,
                loading: false,
            },
            '/main/0': {
                path: ComponentPath.fromString('/main/0'),
                type: 'part',
                element: component,
                parentPath: '/main',
                children: [],
                empty: true,
                error: false,
                descriptor: 'app:test',
                loading: false,
            },
        };
        setRegistry(records);

        // The component is not a direct DOM child of the region; inserting into
        // the region itself would throw NotFoundError.
        const anchor = ensurePlaceholderAnchor(undefined, records['/main'], 0);

        expect(anchor.parentElement).toBe(wrapper);
        expect(anchor.nextElementSibling).toBe(component);
    });
});

describe('inferAxis', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('uses flex direction for flex regions', () => {
        const regionEl = document.createElement('section');
        regionEl.style.display = 'flex';
        regionEl.style.flexDirection = 'row';
        document.body.appendChild(regionEl);

        expect(inferAxis(regionEl, [])).toBe('x');

        regionEl.style.flexDirection = 'column';
        expect(inferAxis(regionEl, [])).toBe('y');
    });

    it('compares sibling offsets when at least two children exist', () => {
        const regionEl = document.createElement('section');
        const first = document.createElement('article');
        const second = document.createElement('article');
        regionEl.append(first, second);
        document.body.appendChild(regionEl);

        setRect(first, {top: 0, left: 0, width: 1000, height: 100});
        setRect(second, {top: 100, left: 0, width: 1000, height: 100});
        expect(inferAxis(regionEl, [createChildRecord(first), createChildRecord(second)])).toBe('y');

        setRect(second, {top: 0, left: 1000, width: 1000, height: 100});
        expect(inferAxis(regionEl, [createChildRecord(first), createChildRecord(second)])).toBe('x');
    });

    it('treats a lone full-width block child as vertical flow', () => {
        const regionEl = document.createElement('section');
        const child = document.createElement('article');
        regionEl.appendChild(child);
        document.body.appendChild(regionEl);

        // Wide and flat — the aspect ratio must not flip the axis to 'x': the
        // remaining sibling after excluding a dragged source is often full-width.
        setRect(child, {top: 0, left: 0, width: 1000, height: 150});

        expect(inferAxis(regionEl, [createChildRecord(child)])).toBe('y');
    });

    it('treats a lone inline-level child as horizontal flow', () => {
        const regionEl = document.createElement('section');
        const child = document.createElement('article');
        child.style.display = 'inline-block';
        regionEl.appendChild(child);
        document.body.appendChild(regionEl);

        setRect(child, {top: 0, left: 0, width: 200, height: 100});

        expect(inferAxis(regionEl, [createChildRecord(child)])).toBe('x');
    });

    it('treats a lone floated child as horizontal flow', () => {
        const regionEl = document.createElement('section');
        const child = document.createElement('article');
        child.style.cssFloat = 'left';
        regionEl.appendChild(child);
        document.body.appendChild(regionEl);

        setRect(child, {top: 0, left: 0, width: 200, height: 100});

        expect(inferAxis(regionEl, [createChildRecord(child)])).toBe('x');
    });

    it('defaults to vertical flow when there are no children', () => {
        const regionEl = document.createElement('section');
        document.body.appendChild(regionEl);

        expect(inferAxis(regionEl, [])).toBe('y');
    });
});
