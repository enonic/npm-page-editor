import type {ComponentPath} from '../protocol';
import type {ComponentRecord} from './registry';

import {fromString} from '../protocol';
import {getPathForElement, rebuildIndex} from './element-index';

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeRecord(p: ComponentPath, element?: HTMLElement): ComponentRecord {
  return {
    path: p,
    type: 'part',
    element,
    parentPath: undefined,
    children: [],
    empty: false,
    error: false,
    descriptor: undefined,
    loading: false,
  };
}

describe('element-index', () => {
  describe('rebuildIndex / getPathForElement', () => {
    it('maps element to its component path', () => {
      const el = document.createElement('div');
      const p = path('/main/0');
      const registry = {[p]: makeRecord(p, el)};

      rebuildIndex(registry);

      expect(getPathForElement(el)).toBe(p);
    });

    it('returns undefined for unknown element', () => {
      const el = document.createElement('div');

      expect(getPathForElement(el)).toBeUndefined();
    });

    it('skips records without an element', () => {
      const p = path('/main/0');
      const registry = {[p]: makeRecord(p)};

      rebuildIndex(registry);

      const orphan = document.createElement('span');
      expect(getPathForElement(orphan)).toBeUndefined();
    });

    it('overwrites previous mappings on rebuild', () => {
      const el = document.createElement('div');
      const p1 = path('/main/0');
      const p2 = path('/main/1');

      rebuildIndex({[p1]: makeRecord(p1, el)});
      expect(getPathForElement(el)).toBe(p1);

      rebuildIndex({[p2]: makeRecord(p2, el)});
      expect(getPathForElement(el)).toBe(p2);
    });

    it('clears stale entries for elements removed from registry', () => {
      const el = document.createElement('div');
      const p = path('/main/0');

      rebuildIndex({[p]: makeRecord(p, el)});
      expect(getPathForElement(el)).toBe(p);

      rebuildIndex({});
      expect(getPathForElement(el)).toBeUndefined();
    });
  });
});
