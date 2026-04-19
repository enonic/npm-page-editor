import type {ComponentPath} from '../protocol';

import {fromString} from '../protocol';
import {createPlaceholderIsland} from '../rendering';
import {$dragState, resetDragState} from '../state';
import {RegionPlaceholder} from './RegionPlaceholder';

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function setDragTarget(targetRegion: ComponentPath | undefined, variant: 'slot' | 'region' | undefined = 'slot'): void {
  $dragState.set({
    itemType: 'part',
    itemLabel: 'Part',
    sourcePath: undefined,
    targetRegion,
    targetIndex: undefined,
    dropAllowed: variant === 'slot',
    message: undefined,
    placeholderElement: undefined,
    placeholderVariant: variant,
    x: undefined,
    y: undefined,
  });
}

beforeAll(() => {
  if (!('replaceSync' in CSSStyleSheet.prototype)) {
    Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', {
      value(_text: string) {
        // no-op
      },
      configurable: true,
      writable: true,
    });
  }

  if (!('adoptedStyleSheets' in ShadowRoot.prototype)) {
    const store = new WeakMap<ShadowRoot, CSSStyleSheet[]>();
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
      get(this: ShadowRoot) {
        return store.get(this) ?? [];
      },
      set(this: ShadowRoot, sheets: CSSStyleSheet[]) {
        store.set(this, sheets);
      },
      configurable: true,
    });
  }
});

describe('RegionPlaceholder', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    resetDragState();
  });

  it('keeps the host visible when the region is not the drag target', () => {
    const region = document.createElement('section');
    document.body.appendChild(region);

    const island = createPlaceholderIsland(region, <RegionPlaceholder path={path('/main')} regionName='main' />);

    expect(island.host.style.display).toBe('block');
  });

  it('hides the host when the drag target matches the region', async () => {
    const region = document.createElement('section');
    document.body.appendChild(region);

    const island = createPlaceholderIsland(region, <RegionPlaceholder path={path('/main')} regionName='main' />);

    setDragTarget(path('/main'));
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(island.host.style.display).toBe('none');
  });

  it('keeps the host visible on region rejection so the column does not collapse', async () => {
    const region = document.createElement('section');
    document.body.appendChild(region);

    const island = createPlaceholderIsland(region, <RegionPlaceholder path={path('/main')} regionName='main' />);

    setDragTarget(path('/main'), 'region');
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(island.host.style.display).toBe('block');
  });

  it('restores host visibility when the drag target moves away', async () => {
    const region = document.createElement('section');
    document.body.appendChild(region);

    const island = createPlaceholderIsland(region, <RegionPlaceholder path={path('/main')} regionName='main' />);

    setDragTarget(path('/main'));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(island.host.style.display).toBe('none');

    setDragTarget(path('/aside'));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(island.host.style.display).toBe('block');
  });
});
