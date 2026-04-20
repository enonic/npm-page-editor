import type {ComponentPath} from '../protocol';
import type {ComponentRecord} from '../state';

import {fromString} from '../protocol';
import {rebuildIndex, setRegistry} from '../state';
import {clearPlaceholder, ensurePlaceholderAnchor, inferDropTarget, validateDrop} from './drop-target';

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeRecord(
  p: string,
  type: ComponentRecord['type'],
  element: HTMLElement | undefined,
  parentPath: string | undefined,
  children: string[] = [],
  maxOccurrences?: number,
): ComponentRecord {
  return {
    path: path(p),
    type,
    element,
    parentPath: parentPath != null ? path(parentPath) : undefined,
    children: children.map(path),
    empty: children.length === 0 && type === 'region',
    error: false,
    descriptor: undefined,
    fragmentContentId: undefined,
    loading: false,
    maxOccurrences,
  };
}

function setRect(el: HTMLElement, rect: Partial<DOMRect>): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  });
}

function setupRegistry(records: Record<string, ComponentRecord>): void {
  setRegistry(records);
  rebuildIndex(records);
}

describe('drop-target', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setRegistry({});
    // jsdom does not implement elementsFromPoint — polyfill for tests
    if (!('elementsFromPoint' in document)) {
      Object.defineProperty(document, 'elementsFromPoint', {value: () => [], writable: true, configurable: true});
    }
  });

  afterEach(() => {
    document.body.innerHTML = '';
    setRegistry({});
  });

  //
  // * inferDropTarget
  //

  describe('inferDropTarget', () => {
    it('returns undefined when no region is under cursor', () => {
      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([]);
      expect(inferDropTarget(100, 100)).toBeUndefined();
    });

    it('returns index 0 for empty region', () => {
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/main': makeRecord('/main', 'region', region, '/', []),
      };
      setupRegistry(records);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);

      const target = inferDropTarget(100, 100);
      expect(target).toMatchObject({regionPath: path('/main'), index: 0, regionEmpty: true, axis: 'y'});
    });

    it('returns correct index when cursor is above child midpoint', () => {
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(region);

      const child0 = document.createElement('div');
      child0.setAttribute('data-portal-component-type', 'part');
      region.appendChild(child0);
      setRect(child0, {top: 0, height: 100});

      const child1 = document.createElement('div');
      child1.setAttribute('data-portal-component-type', 'part');
      region.appendChild(child1);
      setRect(child1, {top: 100, height: 100});

      const records: Record<string, ComponentRecord> = {
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0', '/main/1']),
        '/main/0': makeRecord('/main/0', 'part', child0, '/main'),
        '/main/1': makeRecord('/main/1', 'part', child1, '/main'),
      };
      setupRegistry(records);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([child0, region]);

      // Cursor at y=40, first child midpoint is 50 → insert before first
      const target = inferDropTarget(100, 40);
      expect(target).toMatchObject({regionPath: path('/main'), index: 0, axis: 'y', regionEmpty: false});
    });

    it('returns correct index when cursor is below child midpoint', () => {
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(region);

      const child0 = document.createElement('div');
      child0.setAttribute('data-portal-component-type', 'part');
      region.appendChild(child0);
      setRect(child0, {top: 0, height: 100});

      const child1 = document.createElement('div');
      child1.setAttribute('data-portal-component-type', 'part');
      region.appendChild(child1);
      setRect(child1, {top: 100, height: 100});

      const records: Record<string, ComponentRecord> = {
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0', '/main/1']),
        '/main/0': makeRecord('/main/0', 'part', child0, '/main'),
        '/main/1': makeRecord('/main/1', 'part', child1, '/main'),
      };
      setupRegistry(records);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([child0, region]);

      // Cursor at y=60, first child midpoint is 50 → insert after first
      const target = inferDropTarget(100, 60);
      expect(target).toMatchObject({regionPath: path('/main'), index: 1, axis: 'y'});
    });

    it('returns last index when cursor is past all children', () => {
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(region);

      const child0 = document.createElement('div');
      child0.setAttribute('data-portal-component-type', 'part');
      region.appendChild(child0);
      setRect(child0, {top: 0, height: 100});

      const records: Record<string, ComponentRecord> = {
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0']),
        '/main/0': makeRecord('/main/0', 'part', child0, '/main'),
      };
      setupRegistry(records);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);

      // Cursor at y=200, well past child midpoint (50)
      expect(inferDropTarget(100, 200)).toMatchObject({regionPath: path('/main'), index: 1});
    });

    it('excludes source component from children', () => {
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(region);

      const child0 = document.createElement('div');
      child0.setAttribute('data-portal-component-type', 'part');
      region.appendChild(child0);
      setRect(child0, {top: 0, height: 100});

      const child1 = document.createElement('div');
      child1.setAttribute('data-portal-component-type', 'part');
      region.appendChild(child1);
      setRect(child1, {top: 100, height: 100});

      const records: Record<string, ComponentRecord> = {
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0', '/main/1']),
        '/main/0': makeRecord('/main/0', 'part', child0, '/main'),
        '/main/1': makeRecord('/main/1', 'part', child1, '/main'),
      };
      setupRegistry(records);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([region]);

      // Drag /main/0: only /main/1 considered. Cursor at y=200 → after last = index 1
      const target = inferDropTarget(100, 200, path('/main/0'));
      expect(target).toMatchObject({regionPath: path('/main'), index: 1});
    });

    it('returns undefined for non-region elements', () => {
      const div = document.createElement('div');
      div.setAttribute('data-portal-component-type', 'part');
      document.body.appendChild(div);

      const records: Record<string, ComponentRecord> = {
        '/main/0': makeRecord('/main/0', 'part', div, '/main'),
      };
      setupRegistry(records);

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([div]);

      expect(inferDropTarget(100, 100)).toBeUndefined();
    });
  });

  //
  // * validateDrop
  //

  describe('validateDrop', () => {
    it('allows dropping a part into a top-level region', () => {
      const page = document.createElement('div');
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(page);
      page.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/': makeRecord('/', 'page', page, undefined, ['/main']),
        '/main': makeRecord('/main', 'region', region, '/'),
      };
      setupRegistry(records);

      expect(validateDrop(path('/main/0'), path('/main'), 'part')).toEqual({allowed: true});
    });

    it('rejects layout inside layout', () => {
      const layout = document.createElement('div');
      const region = document.createElement('section');
      document.body.appendChild(layout);
      layout.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/main/0': makeRecord('/main/0', 'layout', layout, '/main', ['/main/0/inner']),
        '/main/0/inner': makeRecord('/main/0/inner', 'region', region, '/main/0'),
      };
      setupRegistry(records);

      const result = validateDrop(undefined, path('/main/0/inner'), 'layout');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Layouts cannot be nested');
    });

    it('rejects drop on own descendant', () => {
      const region = document.createElement('section');
      document.body.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/main/0': makeRecord('/main/0', 'layout', document.createElement('div'), '/main', ['/main/0/inner']),
        '/main/0/inner': makeRecord('/main/0/inner', 'region', region, '/main/0'),
      };
      setupRegistry(records);

      const result = validateDrop(path('/main/0'), path('/main/0/inner'), 'layout');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('inside itself');
    });

    it('rejects fragment-with-layout inside layout', () => {
      const layout = document.createElement('div');
      const region = document.createElement('section');
      document.body.appendChild(layout);
      layout.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/main/0': makeRecord('/main/0', 'layout', layout, '/main', ['/main/0/inner']),
        '/main/0/inner': makeRecord('/main/0/inner', 'region', region, '/main/0'),
        '/main/1': makeRecord('/main/1', 'fragment', document.createElement('div'), '/main', ['/main/1/sub']),
        '/main/1/sub': makeRecord('/main/1/sub', 'region', document.createElement('section'), '/main/1', [
          '/main/1/sub/0',
        ]),
        '/main/1/sub/0': makeRecord('/main/1/sub/0', 'layout', document.createElement('div'), '/main/1/sub'),
      };
      setupRegistry(records);

      const result = validateDrop(path('/main/1'), path('/main/0/inner'), 'fragment');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('fragment contains a layout');
    });

    it('allows fragment without layout inside layout', () => {
      const layout = document.createElement('div');
      const region = document.createElement('section');
      document.body.appendChild(layout);
      layout.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/main/0': makeRecord('/main/0', 'layout', layout, '/main', ['/main/0/inner']),
        '/main/0/inner': makeRecord('/main/0/inner', 'region', region, '/main/0'),
        '/main/1': makeRecord('/main/1', 'fragment', document.createElement('div'), '/main', ['/main/1/sub']),
        '/main/1/sub': makeRecord('/main/1/sub', 'region', document.createElement('section'), '/main/1', [
          '/main/1/sub/0',
        ]),
        '/main/1/sub/0': makeRecord('/main/1/sub/0', 'text', document.createElement('div'), '/main/1/sub'),
      };
      setupRegistry(records);

      expect(validateDrop(path('/main/1'), path('/main/0/inner'), 'fragment')).toEqual({allowed: true});
    });

    it('allows layout in top-level region', () => {
      const page = document.createElement('div');
      const region = document.createElement('section');
      document.body.appendChild(page);
      page.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/': makeRecord('/', 'page', page, undefined, ['/main']),
        '/main': makeRecord('/main', 'region', region, '/'),
      };
      setupRegistry(records);

      expect(validateDrop(undefined, path('/main'), 'layout')).toEqual({allowed: true});
    });

    it('rejects drop on an occupied layout cell', () => {
      const layout = document.createElement('div');
      const region = document.createElement('section');
      document.body.appendChild(layout);
      layout.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/main/0': makeRecord('/main/0', 'layout', layout, '/main', ['/main/0/inner']),
        '/main/0/inner': makeRecord('/main/0/inner', 'region', region, '/main/0', ['/main/0/inner/0']),
        '/main/0/inner/0': makeRecord('/main/0/inner/0', 'part', document.createElement('div'), '/main/0/inner'),
      };
      setupRegistry(records);

      const result = validateDrop(path('/main/1'), path('/main/0/inner'), 'part');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('already occupied');
    });

    it('rejects when region.maxOccurrences is reached even outside a layout', () => {
      const page = document.createElement('div');
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(page);
      page.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/': makeRecord('/', 'page', page, undefined, ['/main']),
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0'], 1),
        '/main/0': makeRecord('/main/0', 'part', document.createElement('div'), '/main'),
      };
      setupRegistry(records);

      const result = validateDrop(path('/main/99'), path('/main'), 'part');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('already occupied');
    });

    it('allows drop up to maxOccurrences and rejects beyond it', () => {
      const page = document.createElement('div');
      const region = document.createElement('section');
      region.setAttribute('data-portal-region', 'main');
      document.body.appendChild(page);
      page.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/': makeRecord('/', 'page', page, undefined, ['/main']),
        '/main': makeRecord('/main', 'region', region, '/', ['/main/0'], 2),
        '/main/0': makeRecord('/main/0', 'part', document.createElement('div'), '/main'),
      };
      setupRegistry(records);

      // 1 existing, cap 2 → still room.
      expect(validateDrop(path('/main/99'), path('/main'), 'part')).toEqual({allowed: true});
    });

    it('ignores the layout single-slot fallback when maxOccurrences is declared', () => {
      const layout = document.createElement('div');
      const region = document.createElement('section');
      document.body.appendChild(layout);
      layout.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/main/0': makeRecord('/main/0', 'layout', layout, '/main', ['/main/0/inner']),
        '/main/0/inner': makeRecord('/main/0/inner', 'region', region, '/main/0', [], 3),
      };
      setupRegistry(records);

      // Layout-nested region, empty, cap 3 → allowed (legacy single-slot would still be empty so moot here,
      // but the declared cap is what drove the decision).
      expect(validateDrop(path('/elsewhere'), path('/main/0/inner'), 'part')).toEqual({allowed: true});
    });

    it('allows dropping back into an empty layout cell (only-child drag)', () => {
      const layout = document.createElement('div');
      const region = document.createElement('section');
      document.body.appendChild(layout);
      layout.appendChild(region);

      const records: Record<string, ComponentRecord> = {
        '/main/0': makeRecord('/main/0', 'layout', layout, '/main', ['/main/0/inner']),
        '/main/0/inner': makeRecord('/main/0/inner', 'region', region, '/main/0', ['/main/0/inner/0']),
        '/main/0/inner/0': makeRecord('/main/0/inner/0', 'part', document.createElement('div'), '/main/0/inner'),
      };
      setupRegistry(records);

      // Source is the sole occupant; the cell is effectively empty for this drag
      expect(validateDrop(path('/main/0/inner/0'), path('/main/0/inner'), 'part')).toEqual({allowed: true});
    });
  });

  //
  // * Placeholder anchor management
  //

  describe('ensurePlaceholderAnchor', () => {
    it('creates a new element when current is undefined', () => {
      const region = document.createElement('section');
      document.body.appendChild(region);

      const anchor = ensurePlaceholderAnchor(undefined, region, 0);
      expect(anchor).toBeInstanceOf(HTMLElement);
      expect(anchor.hasAttribute('data-pe-drag-anchor')).toBe(true);
      expect(anchor.parentElement).toBe(region);
    });

    it('reuses existing element', () => {
      const region = document.createElement('section');
      document.body.appendChild(region);

      const first = ensurePlaceholderAnchor(undefined, region, 0);
      const second = ensurePlaceholderAnchor(first, region, 0);
      expect(second).toBe(first);
    });

    it('inserts at correct position', () => {
      const region = document.createElement('section');
      const child0 = document.createElement('div');
      const child1 = document.createElement('div');
      region.appendChild(child0);
      region.appendChild(child1);
      document.body.appendChild(region);

      const anchor = ensurePlaceholderAnchor(undefined, region, 1);
      expect(region.children[1]).toBe(anchor);
    });

    it('takes 120px of height on vertical axis so siblings are pushed apart', () => {
      const region = document.createElement('section');
      document.body.appendChild(region);

      const anchor = ensurePlaceholderAnchor(undefined, region, 0, undefined, 'y');
      expect(anchor.style.height).toBe('120px');
      expect(anchor.style.width).toBe('');
    });

    it('takes 120px of width on horizontal axis so siblings are pushed apart', () => {
      const region = document.createElement('section');
      document.body.appendChild(region);

      const anchor = ensurePlaceholderAnchor(undefined, region, 0, undefined, 'x');
      expect(anchor.style.width).toBe('120px');
      expect(anchor.style.height).toBe('');
      expect(anchor.style.alignSelf).toBe('stretch');
    });

    it('participates in region flow with pointer-events disabled', () => {
      const region = document.createElement('section');
      const child = document.createElement('div');
      region.appendChild(child);
      document.body.appendChild(region);

      const anchor = ensurePlaceholderAnchor(undefined, region, 0);
      // No `position: fixed` — the anchor must stay in flex/grid flow to displace siblings.
      expect(anchor.style.position).toBe('');
      expect(anchor.style.pointerEvents).toBe('none');
    });

    it('clears any leftover positional styles when reused from a prior session', () => {
      // ? `ensurePlaceholderAnchor` may receive an existing element that was previously
      // ? positioned. Leaving `position: fixed` / `top` / `left` on the node would detach it
      // ? from the flow on the next insertion.
      const region = document.createElement('section');
      document.body.appendChild(region);

      const stale = document.createElement('div');
      stale.style.position = 'fixed';
      stale.style.top = '100px';
      stale.style.left = '50px';

      const anchor = ensurePlaceholderAnchor(stale, region, 0, undefined, 'y');
      expect(anchor).toBe(stale);
      expect(anchor.style.position).toBe('');
      expect(anchor.style.top).toBe('');
      expect(anchor.style.left).toBe('');
      expect(anchor.style.height).toBe('120px');
    });
  });

  describe('clearPlaceholder', () => {
    it('removes element from DOM', () => {
      const parent = document.createElement('div');
      const el = document.createElement('div');
      parent.appendChild(el);
      document.body.appendChild(parent);

      clearPlaceholder(el);
      expect(el.parentElement).toBeNull();
    });

    it('handles undefined gracefully', () => {
      expect(() => clearPlaceholder(undefined)).not.toThrow();
    });
  });
});
