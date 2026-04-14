import {isErr} from '../result';
import {
  append,
  componentIndex,
  depth,
  equals,
  fromString,
  insertAt,
  isComponent,
  isDescendantOf,
  isRegion,
  parent,
  regionName,
  root,
  type ComponentPath,
} from './path';

/** Unwraps a successful Result or throws — keeps test code concise. */
function unwrap(raw: string): ComponentPath {
  const result = fromString(raw);

  if (isErr(result)) throw new Error(`Expected ok for "${raw}", got error: ${result.error}`);

  return result.value;
}

describe('ComponentPath', () => {
  describe('brand safety', () => {
    it('prevents raw string assignment at compile time', () => {
      // @ts-expect-error -- raw string is not assignable to ComponentPath
      const _path: ComponentPath = '/main/0';
      void _path;
    });
  });

  describe('root', () => {
    it('returns the root path "/"', () => {
      expect(root()).toBe('/');
    });
  });

  describe('fromString', () => {
    it('returns ok for a valid root path', () => {
      const result = fromString('/');
      expect(result).toEqual({ok: true, value: '/'});
    });

    it('returns ok for a valid region path', () => {
      const result = fromString('/main');
      expect(result).toEqual({ok: true, value: '/main'});
    });

    it('returns ok for a valid component path', () => {
      const result = fromString('/main/0');
      expect(result).toEqual({ok: true, value: '/main/0'});
    });

    it('returns ok for a deeply nested path', () => {
      const result = fromString('/main/0/left/2');
      expect(result).toEqual({ok: true, value: '/main/0/left/2'});
    });

    it('returns err on empty string', () => {
      const result = fromString('');
      expect(result).toEqual({ok: false, error: 'Path must not be empty'});
    });

    it('returns err on missing leading slash', () => {
      const result = fromString('main/0');
      expect(result).toEqual({ok: false, error: "Path must start with '/'"});
    });

    it('returns err on trailing slash', () => {
      const result = fromString('/main/');
      expect(result).toEqual({ok: false, error: 'Path must not have trailing slash'});
    });

    it('returns err on empty segments', () => {
      const result = fromString('/main//0');
      expect(result).toEqual({ok: false, error: 'Path must not contain empty segments'});
    });

    it('returns err on negative index', () => {
      const result = fromString('/main/-1');
      expect(result).toEqual({ok: false, error: 'Path segment must not be a negative index'});
    });

    it('returns err on non-alternating segments (two names)', () => {
      const result = fromString('/main/left');
      expect(result.ok).toBe(false);
      if (isErr(result)) expect(result.error).toContain('Path segments must alternate');
    });

    it('returns err on non-alternating segments (two indices)', () => {
      const result = fromString('/0/1');
      expect(result.ok).toBe(false);
      if (isErr(result)) expect(result.error).toContain('Path segments must alternate');
    });

    it('returns err on leading numeric segment', () => {
      const result = fromString('/0');
      expect(result.ok).toBe(false);
      if (isErr(result)) expect(result.error).toContain('Path segments must alternate');
    });
  });

  describe('parent', () => {
    it('returns undefined for root', () => {
      expect(parent(root())).toBeUndefined();
    });

    it('returns root for a top-level region', () => {
      expect(parent(unwrap('/main'))).toBe('/');
    });

    it('returns the region path for a component', () => {
      expect(parent(unwrap('/main/0'))).toBe('/main');
    });

    it('returns the component path for a nested region', () => {
      expect(parent(unwrap('/main/0/left'))).toBe('/main/0');
    });

    it('returns the region path for a deeply nested component', () => {
      expect(parent(unwrap('/main/0/left/2'))).toBe('/main/0/left');
    });
  });

  describe('regionName', () => {
    it('returns undefined for root', () => {
      expect(regionName(root())).toBeUndefined();
    });

    it('returns the name for a region path', () => {
      expect(regionName(unwrap('/main'))).toBe('main');
    });

    it('returns the parent region name for a component path', () => {
      expect(regionName(unwrap('/main/0'))).toBe('main');
    });

    it('returns the last region name for a nested region', () => {
      expect(regionName(unwrap('/main/0/left'))).toBe('left');
    });

    it('returns the last region name for a deeply nested component', () => {
      expect(regionName(unwrap('/main/0/left/2'))).toBe('left');
    });
  });

  describe('componentIndex', () => {
    it('returns undefined for root', () => {
      expect(componentIndex(root())).toBeUndefined();
    });

    it('returns undefined for a region path', () => {
      expect(componentIndex(unwrap('/main'))).toBeUndefined();
    });

    it('returns the index for a component path', () => {
      expect(componentIndex(unwrap('/main/0'))).toBe(0);
    });

    it('returns the last index for a deeply nested component', () => {
      expect(componentIndex(unwrap('/main/0/left/2'))).toBe(2);
    });
  });

  describe('append', () => {
    it('appends a region name to root', () => {
      expect(append(root(), 'main')).toBe('/main');
    });

    it('appends an index to a region path', () => {
      expect(append(unwrap('/main'), undefined, 0)).toBe('/main/0');
    });

    it('appends both region and index', () => {
      expect(append(root(), 'main', 0)).toBe('/main/0');
    });

    it('appends a region to a component path', () => {
      expect(append(unwrap('/main/0'), 'left')).toBe('/main/0/left');
    });

    it('appends region and index to a component path', () => {
      expect(append(unwrap('/main/0'), 'left', 2)).toBe('/main/0/left/2');
    });

    it('returns the same path when called with no extra segments', () => {
      const p = unwrap('/main');
      expect(append(p)).toBe('/main');
    });
  });

  describe('insertAt', () => {
    it('builds a component path from a region path and index', () => {
      expect(insertAt(unwrap('/main'), 0)).toBe('/main/0');
    });

    it('builds a nested component path', () => {
      expect(insertAt(unwrap('/main/0/left'), 2)).toBe('/main/0/left/2');
    });
  });

  describe('isRegion', () => {
    it('returns true for root', () => {
      expect(isRegion(root())).toBe(true);
    });

    it('returns true for a region path', () => {
      expect(isRegion(unwrap('/main'))).toBe(true);
    });

    it('returns false for a component path', () => {
      expect(isRegion(unwrap('/main/0'))).toBe(false);
    });

    it('returns true for a nested region', () => {
      expect(isRegion(unwrap('/main/0/left'))).toBe(true);
    });
  });

  describe('isComponent', () => {
    it('returns false for root', () => {
      expect(isComponent(root())).toBe(false);
    });

    it('returns false for a region path', () => {
      expect(isComponent(unwrap('/main'))).toBe(false);
    });

    it('returns true for a component path', () => {
      expect(isComponent(unwrap('/main/0'))).toBe(true);
    });

    it('returns true for a nested component', () => {
      expect(isComponent(unwrap('/main/0/left/2'))).toBe(true);
    });
  });

  describe('equals', () => {
    it('returns true for identical paths', () => {
      expect(equals(unwrap('/main/0'), unwrap('/main/0'))).toBe(true);
    });

    it('returns false for different paths', () => {
      expect(equals(unwrap('/main/0'), unwrap('/main/1'))).toBe(false);
    });

    it('returns true for root compared to root', () => {
      expect(equals(root(), root())).toBe(true);
    });
  });

  describe('isDescendantOf', () => {
    it('returns true for a direct child', () => {
      expect(isDescendantOf(unwrap('/main/0'), unwrap('/main'))).toBe(true);
    });

    it('returns true for a deep descendant of root', () => {
      expect(isDescendantOf(unwrap('/main/0/left/2'), root())).toBe(true);
    });

    it('returns false for the same path', () => {
      expect(isDescendantOf(unwrap('/main'), unwrap('/main'))).toBe(false);
    });

    it('returns false for unrelated paths', () => {
      expect(isDescendantOf(unwrap('/aside/0'), unwrap('/main'))).toBe(false);
    });

    it('returns false for root as child', () => {
      expect(isDescendantOf(root(), unwrap('/main'))).toBe(false);
    });

    it('returns true for any non-root path as descendant of root', () => {
      expect(isDescendantOf(unwrap('/main'), root())).toBe(true);
    });

    it('does not match partial segment names', () => {
      expect(isDescendantOf(unwrap('/main2/0'), unwrap('/main'))).toBe(false);
    });
  });

  describe('depth', () => {
    it('returns 0 for root', () => {
      expect(depth(root())).toBe(0);
    });

    it('returns 1 for a top-level region', () => {
      expect(depth(unwrap('/main'))).toBe(1);
    });

    it('returns 2 for a component in a region', () => {
      expect(depth(unwrap('/main/0'))).toBe(2);
    });

    it('returns 4 for a deeply nested component', () => {
      expect(depth(unwrap('/main/0/left/2'))).toBe(4);
    });
  });
});
