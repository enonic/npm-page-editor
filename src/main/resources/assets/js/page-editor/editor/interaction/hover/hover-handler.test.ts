import {ComponentPath} from '@enonic/lib-contentstudio/app/page/region/ComponentPath';
import type {ComponentRecord} from '../../types';
import {rebuildIndex} from '../../stores/element-index';
import {$hoveredPath, setDragState, setHoveredPath, setRegistry} from '../../stores/registry';
import {initHoverDetection} from './hover-handler';

function createRecord(path: string, element: HTMLElement): ComponentRecord {
    return {
        path: ComponentPath.fromString(path),
        type: 'part',
        element,
        parentPath: '/main',
        children: [],
        empty: false,
        error: false,
        descriptor: 'app:part',
        loading: false,
    };
}

describe('initHoverDetection', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        setRegistry({});
        setHoveredPath(undefined);
        setDragState(undefined);
    });

    it('tracks hovered components from document mouse events', () => {
        const element = document.createElement('article');
        element.dataset.portalComponentType = 'part';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element),
        };

        setRegistry(records);
        rebuildIndex(records);

        const stop = initHoverDetection();

        element.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        expect($hoveredPath.get()).toBe('/main/0');

        element.dispatchEvent(new MouseEvent('mouseout', {
            bubbles: true,
            relatedTarget: document.body,
        }));
        expect($hoveredPath.get()).toBeUndefined();

        stop();
    });

    it('suppresses hover tracking while drag feedback is active', () => {
        const element = document.createElement('article');
        element.dataset.portalComponentType = 'part';
        document.body.appendChild(element);

        const records = {
            '/main/0': createRecord('/main/0', element),
        };

        setRegistry(records);
        rebuildIndex(records);
        setDragState({
            itemType: 'part',
            itemLabel: 'Hero',
            sourcePath: '/main/0',
            targetPath: '/main',
            dropAllowed: true,
            message: undefined,
            placeholderElement: undefined,
            x: 10,
            y: 20,
        });

        const stop = initHoverDetection();

        element.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        expect($hoveredPath.get()).toBeUndefined();

        stop();
    });
});
