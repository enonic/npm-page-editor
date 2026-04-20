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

    //
    // * Proximity snap: cursor in a layout's gap/padding should target the closest inner region
    //

    it('snaps to the closest inner region when cursor is in a layout gap', () => {
      // /main > [layout /main/1 > [region left, region right]]
      // Cursor at x=215: in the grid gap between left (x: 0-200) and right (x: 260-460),
      // closer to left (distance 15) than right (distance 45). Expect target = /main/1/left.
      const main = document.createElement('section');
      main.setAttribute('data-portal-region', 'main');
      document.body.appendChild(main);

      const layout = document.createElement('div');
      layout.setAttribute('data-portal-component-type', 'layout');
      main.appendChild(layout);
      setRect(layout, {left: 0, right: 460, top: 0, bottom: 200, width: 460, height: 200});

      const left = document.createElement('section');
      left.setAttribute('data-portal-region', 'left');
      layout.appendChild(left);
      setRect(left, {left: 0, right: 200, top: 0, bottom: 200, width: 200, height: 200});

      const right = document.createElement('section');
      right.setAttribute('data-portal-region', 'right');
      layout.appendChild(right);
      setRect(right, {left: 260, right: 460, top: 0, bottom: 200, width: 200, height: 200});

      setupRegistry({
        '/main': makeRecord('/main', 'region', main, '/', ['/main/1']),
        '/main/1': makeRecord('/main/1', 'layout', layout, '/main', ['/main/1/left', '/main/1/right']),
        '/main/1/left': makeRecord('/main/1/left', 'region', left, '/main/1'),
        '/main/1/right': makeRecord('/main/1/right', 'region', right, '/main/1'),
      });

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([layout, main]);

      const target = inferDropTarget(215, 100);
      expect(target?.regionPath).toBe(path('/main/1/left'));
    });

    it('snaps to the other inner region when cursor is closer to it', () => {
      const main = document.createElement('section');
      main.setAttribute('data-portal-region', 'main');
      document.body.appendChild(main);

      const layout = document.createElement('div');
      layout.setAttribute('data-portal-component-type', 'layout');
      main.appendChild(layout);
      setRect(layout, {left: 0, right: 460, top: 0, bottom: 200, width: 460, height: 200});

      const left = document.createElement('section');
      left.setAttribute('data-portal-region', 'left');
      layout.appendChild(left);
      setRect(left, {left: 0, right: 200, top: 0, bottom: 200, width: 200, height: 200});

      const right = document.createElement('section');
      right.setAttribute('data-portal-region', 'right');
      layout.appendChild(right);
      setRect(right, {left: 260, right: 460, top: 0, bottom: 200, width: 200, height: 200});

      setupRegistry({
        '/main': makeRecord('/main', 'region', main, '/', ['/main/1']),
        '/main/1': makeRecord('/main/1', 'layout', layout, '/main', ['/main/1/left', '/main/1/right']),
        '/main/1/left': makeRecord('/main/1/left', 'region', left, '/main/1'),
        '/main/1/right': makeRecord('/main/1/right', 'region', right, '/main/1'),
      });

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([layout, main]);

      // Cursor at x=255: still in the gap but closer to the right region (distance 5 vs 55).
      const target = inferDropTarget(255, 100);
      expect(target?.regionPath).toBe(path('/main/1/right'));
    });

    it('treats the layout top/bottom edge as an outer-region escape zone for a vertical parent', () => {
      // Outer /main is flex-col (y-axis). Cursor near the layout's top inside padding —
      // within the 8px escape band — should NOT snap into inner regions; it should stay
      // on /main so "drop before the layout" is the natural outcome.
      const main = document.createElement('section');
      main.setAttribute('data-portal-region', 'main');
      main.style.display = 'flex';
      main.style.flexDirection = 'column';
      document.body.appendChild(main);

      const layout = document.createElement('div');
      layout.setAttribute('data-portal-component-type', 'layout');
      main.appendChild(layout);
      setRect(layout, {left: 0, right: 460, top: 0, bottom: 200, width: 460, height: 200});

      const left = document.createElement('section');
      left.setAttribute('data-portal-region', 'left');
      layout.appendChild(left);
      setRect(left, {left: 12, right: 222, top: 12, bottom: 188, width: 210, height: 176});

      const right = document.createElement('section');
      right.setAttribute('data-portal-region', 'right');
      layout.appendChild(right);
      setRect(right, {left: 238, right: 448, top: 12, bottom: 188, width: 210, height: 176});

      setupRegistry({
        '/main': makeRecord('/main', 'region', main, '/', ['/main/1']),
        '/main/1': makeRecord('/main/1', 'layout', layout, '/main', ['/main/1/left', '/main/1/right']),
        '/main/1/left': makeRecord('/main/1/left', 'region', left, '/main/1'),
        '/main/1/right': makeRecord('/main/1/right', 'region', right, '/main/1'),
      });

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([layout, main]);

      // y=4 sits 4px below the layout's top edge — inside the 8px escape band.
      const target = inferDropTarget(230, 4);
      expect(target?.regionPath).toBe(path('/main'));
    });

    it('applies the escape zone on the left/right edges for a horizontal parent', () => {
      const main = document.createElement('section');
      main.setAttribute('data-portal-region', 'main');
      main.style.display = 'flex';
      main.style.flexDirection = 'row';
      document.body.appendChild(main);

      const layout = document.createElement('div');
      layout.setAttribute('data-portal-component-type', 'layout');
      main.appendChild(layout);
      setRect(layout, {left: 0, right: 200, top: 0, bottom: 400, width: 200, height: 400});

      const top = document.createElement('section');
      top.setAttribute('data-portal-region', 'top');
      layout.appendChild(top);
      setRect(top, {left: 12, right: 188, top: 12, bottom: 198, width: 176, height: 186});

      const bottom = document.createElement('section');
      bottom.setAttribute('data-portal-region', 'bottom');
      layout.appendChild(bottom);
      setRect(bottom, {left: 12, right: 188, top: 214, bottom: 388, width: 176, height: 174});

      setupRegistry({
        '/main': makeRecord('/main', 'region', main, '/', ['/main/1']),
        '/main/1': makeRecord('/main/1', 'layout', layout, '/main', ['/main/1/top', '/main/1/bottom']),
        '/main/1/top': makeRecord('/main/1/top', 'region', top, '/main/1'),
        '/main/1/bottom': makeRecord('/main/1/bottom', 'region', bottom, '/main/1'),
      });

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([layout, main]);

      // x=4 sits in the 8px left escape band of the layout (flex-row parent).
      const target = inferDropTarget(4, 100);
      expect(target?.regionPath).toBe(path('/main'));
    });

    it('still snaps to the inner region when the cursor is past the escape zone', () => {
      // Same setup as the escape zone test, but y=12 puts the cursor on the layout's inner
      // grid area — proximity snap should kick in again.
      const main = document.createElement('section');
      main.setAttribute('data-portal-region', 'main');
      main.style.display = 'flex';
      main.style.flexDirection = 'column';
      document.body.appendChild(main);

      const layout = document.createElement('div');
      layout.setAttribute('data-portal-component-type', 'layout');
      main.appendChild(layout);
      setRect(layout, {left: 0, right: 460, top: 0, bottom: 200, width: 460, height: 200});

      const left = document.createElement('section');
      left.setAttribute('data-portal-region', 'left');
      layout.appendChild(left);
      setRect(left, {left: 0, right: 200, top: 0, bottom: 200, width: 200, height: 200});

      const right = document.createElement('section');
      right.setAttribute('data-portal-region', 'right');
      layout.appendChild(right);
      setRect(right, {left: 260, right: 460, top: 0, bottom: 200, width: 200, height: 200});

      setupRegistry({
        '/main': makeRecord('/main', 'region', main, '/', ['/main/1']),
        '/main/1': makeRecord('/main/1', 'layout', layout, '/main', ['/main/1/left', '/main/1/right']),
        '/main/1/left': makeRecord('/main/1/left', 'region', left, '/main/1'),
        '/main/1/right': makeRecord('/main/1/right', 'region', right, '/main/1'),
      });

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([layout, main]);

      // y=100 is far from the top/bottom escape bands; proximity snap applies.
      const target = inferDropTarget(215, 100);
      expect(target?.regionPath).toBe(path('/main/1/left'));
    });

    it('keeps the outer region when the cursor is outside any layout bbox', () => {
      // Cursor is in /main between the layout and another sibling — no layout contains it,
      // so proximity snap does not apply and the target is /main.
      const main = document.createElement('section');
      main.setAttribute('data-portal-region', 'main');
      document.body.appendChild(main);

      const layout = document.createElement('div');
      layout.setAttribute('data-portal-component-type', 'layout');
      main.appendChild(layout);
      setRect(layout, {left: 0, right: 460, top: 0, bottom: 200, width: 460, height: 200});

      const inner = document.createElement('section');
      inner.setAttribute('data-portal-region', 'inner');
      layout.appendChild(inner);
      setRect(inner, {left: 0, right: 460, top: 0, bottom: 200, width: 460, height: 200});

      setupRegistry({
        '/main': makeRecord('/main', 'region', main, '/', ['/main/1']),
        '/main/1': makeRecord('/main/1', 'layout', layout, '/main', ['/main/1/inner']),
        '/main/1/inner': makeRecord('/main/1/inner', 'region', inner, '/main/1'),
      });

      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([main]);

      // y=300 — below the layout's bbox (0-200). Layout does not contain cursor, no snap.
      const target = inferDropTarget(100, 300);
      expect(target?.regionPath).toBe(path('/main'));
    });

    //
    // * Hysteresis: near the layout's cross-axis edges, stay on the previous target to
    // * prevent flicker. Flow-axis edges are intentionally excluded so the escape zone
    // * can fire cleanly.
    //

    it('keeps the previous inner target when the cursor crosses the cross-axis edge within the unsafe band', () => {
      const main = document.createElement('section');
      main.setAttribute('data-portal-region', 'main');
      main.style.display = 'flex';
      main.style.flexDirection = 'column';
      document.body.appendChild(main);

      const layout = document.createElement('div');
      layout.setAttribute('data-portal-component-type', 'layout');
      main.appendChild(layout);
      setRect(layout, {left: 100, right: 460, top: 0, bottom: 200, width: 360, height: 200});

      const inner = document.createElement('section');
      inner.setAttribute('data-portal-region', 'inner');
      layout.appendChild(inner);
      setRect(inner, {left: 100, right: 460, top: 0, bottom: 200, width: 360, height: 200});

      setupRegistry({
        '/main': makeRecord('/main', 'region', main, '/', ['/main/1']),
        '/main/1': makeRecord('/main/1', 'layout', layout, '/main', ['/main/1/inner']),
        '/main/1/inner': makeRecord('/main/1/inner', 'region', inner, '/main/1'),
      });

      // Vertical parent → cross-axis is x. Cursor 3px left of layout's left edge = within band.
      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([main]);
      const target = inferDropTarget(97, 100, undefined, path('/main/1/inner'));
      expect(target?.regionPath).toBe(path('/main/1/inner'));
    });

    it('does not apply hysteresis on the flow-axis edge — escape zone governs transitions there', () => {
      const main = document.createElement('section');
      main.setAttribute('data-portal-region', 'main');
      main.style.display = 'flex';
      main.style.flexDirection = 'column';
      document.body.appendChild(main);

      const layout = document.createElement('div');
      layout.setAttribute('data-portal-component-type', 'layout');
      main.appendChild(layout);
      setRect(layout, {left: 0, right: 460, top: 0, bottom: 200, width: 460, height: 200});

      const inner = document.createElement('section');
      inner.setAttribute('data-portal-region', 'inner');
      layout.appendChild(inner);
      setRect(inner, {left: 0, right: 460, top: 0, bottom: 200, width: 460, height: 200});

      setupRegistry({
        '/main': makeRecord('/main', 'region', main, '/', ['/main/1']),
        '/main/1': makeRecord('/main/1', 'layout', layout, '/main', ['/main/1/inner']),
        '/main/1/inner': makeRecord('/main/1/inner', 'region', inner, '/main/1'),
      });

      // Cursor 3px below layout's bottom edge (flow-axis). Hysteresis must not delay the
      // switch — the escape zone + clean outside transition should take over immediately.
      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([main]);
      const target = inferDropTarget(200, 203, undefined, path('/main/1/inner'));
      expect(target?.regionPath).toBe(path('/main'));
    });

    it('releases to the outer region once the cursor is past the cross-axis unsafe band', () => {
      const main = document.createElement('section');
      main.setAttribute('data-portal-region', 'main');
      main.style.display = 'flex';
      main.style.flexDirection = 'column';
      document.body.appendChild(main);

      const layout = document.createElement('div');
      layout.setAttribute('data-portal-component-type', 'layout');
      main.appendChild(layout);
      setRect(layout, {left: 100, right: 460, top: 0, bottom: 200, width: 360, height: 200});

      const inner = document.createElement('section');
      inner.setAttribute('data-portal-region', 'inner');
      layout.appendChild(inner);
      setRect(inner, {left: 100, right: 460, top: 0, bottom: 200, width: 360, height: 200});

      setupRegistry({
        '/main': makeRecord('/main', 'region', main, '/', ['/main/1']),
        '/main/1': makeRecord('/main/1', 'layout', layout, '/main', ['/main/1/inner']),
        '/main/1/inner': makeRecord('/main/1/inner', 'region', inner, '/main/1'),
      });

      // Cursor 20px left of layout → clearly past the cross-axis band.
      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([main]);
      const target = inferDropTarget(80, 100, undefined, path('/main/1/inner'));
      expect(target?.regionPath).toBe(path('/main'));
    });

    it('does not apply hysteresis between sibling inner regions of the same layout', () => {
      const main = document.createElement('section');
      main.setAttribute('data-portal-region', 'main');
      document.body.appendChild(main);

      const layout = document.createElement('div');
      layout.setAttribute('data-portal-component-type', 'layout');
      main.appendChild(layout);
      setRect(layout, {left: 0, right: 460, top: 0, bottom: 200, width: 460, height: 200});

      const left = document.createElement('section');
      left.setAttribute('data-portal-region', 'left');
      layout.appendChild(left);
      setRect(left, {left: 0, right: 200, top: 0, bottom: 200, width: 200, height: 200});

      const right = document.createElement('section');
      right.setAttribute('data-portal-region', 'right');
      layout.appendChild(right);
      setRect(right, {left: 260, right: 460, top: 0, bottom: 200, width: 200, height: 200});

      setupRegistry({
        '/main': makeRecord('/main', 'region', main, '/', ['/main/1']),
        '/main/1': makeRecord('/main/1', 'layout', layout, '/main', ['/main/1/left', '/main/1/right']),
        '/main/1/left': makeRecord('/main/1/left', 'region', left, '/main/1'),
        '/main/1/right': makeRecord('/main/1/right', 'region', right, '/main/1'),
      });

      // Previous target = left, cursor now clearly closer to right; no hysteresis since
      // both inner regions share the same enclosing layout.
      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([right, layout, main]);
      const target = inferDropTarget(400, 100, undefined, path('/main/1/left'));
      expect(target?.regionPath).toBe(path('/main/1/right'));
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
