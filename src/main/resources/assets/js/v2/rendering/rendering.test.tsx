import {injectStyles} from './inject-styles';
import {createOverlayHost} from './overlay-host';
import {createPlaceholderIsland} from './placeholder-island';

// JSDOM lacks adoptedStyleSheets and CSSStyleSheet.replaceSync — polyfill both
beforeAll(() => {
  if (!('replaceSync' in CSSStyleSheet.prototype)) {
    Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', {
      value(_text: string) {
        // no-op: JSDOM polyfill
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

describe('shadow rendering', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('injectStyles', () => {
    it('adopts a shared CSSStyleSheet on the shadow root', () => {
      const host = document.createElement('div');
      const shadow = host.attachShadow({mode: 'open'});

      injectStyles(shadow);

      expect(shadow.adoptedStyleSheets.length).toBe(1);
      expect(shadow.adoptedStyleSheets[0]).toBeInstanceOf(CSSStyleSheet);
    });

    it('reuses the same sheet across multiple shadow roots', () => {
      const hostA = document.createElement('div');
      const shadowA = hostA.attachShadow({mode: 'open'});
      const hostB = document.createElement('div');
      const shadowB = hostB.attachShadow({mode: 'open'});

      injectStyles(shadowA);
      injectStyles(shadowB);

      expect(shadowA.adoptedStyleSheets[0]).toBe(shadowB.adoptedStyleSheets[0]);
    });
  });

  describe('createOverlayHost', () => {
    it('creates a fixed overlay element on document.body', () => {
      const overlay = createOverlayHost(<div data-testid='overlay-child'>Overlay</div>);

      expect(document.getElementById('pe-overlay-host')).not.toBeNull();
      expect(overlay.root.adoptedStyleSheets.length).toBeGreaterThan(0);
      expect(overlay.root.textContent).toContain('Overlay');

      overlay.unmount();
      expect(document.getElementById('pe-overlay-host')).toBeNull();
    });
  });

  describe('createPlaceholderIsland', () => {
    it('mounts a placeholder into an isolated shadow island', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const island = createPlaceholderIsland(container, <div data-testid='placeholder-child'>Placeholder</div>);

      expect(island.container).toBe(container);
      expect(container.querySelector('[data-pe-placeholder-host]')).toBe(island.host);
      expect(island.shadow.adoptedStyleSheets.length).toBeGreaterThan(0);
      expect(island.shadow.textContent).toContain('Placeholder');

      island.unmount();
      expect(container.querySelector('[data-pe-placeholder-host]')).toBeNull();
    });
  });
});
