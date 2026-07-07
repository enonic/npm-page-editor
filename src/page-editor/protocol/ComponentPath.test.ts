import {describe, expect, it} from 'vite-plus/test';

import {ComponentPath} from './ComponentPath';

describe('ComponentPath', () => {
    it('parses and serializes the root path', () => {
        const root = ComponentPath.fromString('/');

        expect(root.isRoot()).toBe(true);
        expect(root.toString()).toBe('/');
        expect(root.getPath()).toBe('/');
        expect(root.getParentPath()).toBeUndefined();
        expect(ComponentPath.root().equals(root)).toBe(true);
    });

    it('treats blank input as root', () => {
        expect(ComponentPath.fromString('').isRoot()).toBe(true);
        expect(ComponentPath.fromString(undefined).isRoot()).toBe(true);
    });

    it('round-trips region and component paths', () => {
        ['/main', '/main/0', '/main/0/left', '/main/0/left/1'].forEach(path => {
            expect(ComponentPath.fromString(path).toString()).toBe(path);
        });
    });

    it('distinguishes region paths from component paths', () => {
        expect(ComponentPath.fromString('/main').isRegionPath()).toBe(true);
        expect(ComponentPath.fromString('/main').isComponentPath()).toBe(false);
        expect(ComponentPath.fromString('/main/0').isComponentPath()).toBe(true);
        expect(ComponentPath.fromString('/main/0/left/1').isComponentPath()).toBe(true);
        expect(ComponentPath.fromString('/').isComponentPath()).toBe(true);
    });

    it('exposes numeric component indices', () => {
        expect(ComponentPath.fromString('/main/2').getComponentIndex()).toBe(2);
        expect(ComponentPath.fromString('/main/2').getPath()).toBe(2);
        expect(ComponentPath.fromString('/main').getComponentIndex()).toBeUndefined();
    });

    it('navigates to parents', () => {
        const path = ComponentPath.fromString('/main/0/left/1');

        expect(path.getParentPath()?.toString()).toBe('/main/0/left');
        expect(path.getParentPath()?.getParentPath()?.toString()).toBe('/main/0');
        expect(ComponentPath.fromString('/main').getParentPath()?.isRoot()).toBe(true);
    });

    it('detects descendants', () => {
        const region = ComponentPath.fromString('/main');
        const nested = ComponentPath.fromString('/main/0/left/1');

        expect(nested.isDescendantOf(region)).toBe(true);
        expect(region.isDescendantOf(nested)).toBe(false);
        expect(nested.isDescendantOf(ComponentPath.fromString('/other'))).toBe(false);
        expect(nested.isDescendantOf(nested)).toBe(false);
    });

    it('produces the canonical string format', () => {
        // Format: root='/', region='/name', component='/name/index', nested='/name/index/region/index'
        expect(ComponentPath.fromString('/').toString()).toBe('/');
        expect(ComponentPath.fromString('/main').toString()).toBe('/main');
        expect(ComponentPath.fromString('/main/0').toString()).toBe('/main/0');
        expect(ComponentPath.fromString('/main/0/left/1').toString()).toBe('/main/0/left/1');
    });
});
