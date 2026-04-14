# Step 06 — Rendering

> SPEC ref: [rendering/](../SPEC-v2.md#rendering)

## Goal

Shadow DOM infrastructure and Tailwind CSS pipeline. This step establishes the rendering foundation that all Preact components (step 08) will use. After this step, Storybook should be able to render content inside shadow roots with full Tailwind styling.

## Scope

```
src/main/resources/assets/js/v2/rendering/
├── overlay-host.ts        ← shared overlay shadow root
├── placeholder-island.tsx ← per-node shadow root for in-flow placeholders
├── inject-styles.ts       ← adoptedStyleSheets with shared CSSStyleSheet
├── editor-ui.css          ← Tailwind entry point for shadow DOM styles
└── index.ts               ← barrel export
```

### overlay-host.ts

```ts
type OverlayHost = {
  root: ShadowRoot;
  unmount: () => void;
};

function createOverlayHost(app: preact.VNode): OverlayHost;
```

- Creates a fixed-position `<div>` on `document.body`
- `z-index: 2147483646`, `pointer-events: none`
- Attaches open shadow root
- Injects editor styles via `injectStyles()`
- Renders the Preact app (`<OverlayApp />`) into the shadow root
- Returns cleanup handle

### placeholder-island.tsx

```ts
type PlaceholderIsland = {
  container: HTMLElement;
  host: HTMLElement;
  shadow: ShadowRoot;
  unmount: () => void;
};

function createPlaceholderIsland(target: HTMLElement, content: preact.VNode): PlaceholderIsland;
```

- Creates a host `<div>` with `data-pe-placeholder-host` attribute (excluded from emptiness detection)
- Appends to target element
- Attaches open shadow root
- Injects styles (same shared stylesheet)
- Renders Preact content into the shadow root

### inject-styles.ts

```ts
function injectStyles(shadowRoot: ShadowRoot): void;
```

Uses `adoptedStyleSheets` with a single shared `CSSStyleSheet` instance:
- The stylesheet is created once via `new CSSStyleSheet()` + `replaceSync(cssText)`
- Every shadow root (overlay host + all placeholder islands) adopts the same sheet
- This avoids O(n) style duplication across shadow roots
- CSS text is imported from `editor-ui.css?inline` (Vite processes Tailwind at build time)

### editor-ui.css — Tailwind setup

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import '@enonic/ui/preset.css';

@source "../";
```

This follows the same pattern as the existing `new-ui/rendering/editor-ui.css`:
- `@import 'tailwindcss'` — Tailwind v4 base
- `@import '@enonic/ui/preset.css'` — Enonic design tokens (@theme block with CSS variables)
- `@source "../"` — scope Tailwind class scanning to the v2 directory
- `@layer base` block for `:host` shadow DOM styles (color tokens, font, transitions)
- Component-level utilities (`.pe-shell`, etc.) if needed

The existing editor-ui.css in `new-ui/rendering/` is the reference. The v2 version may simplify or extend it based on component needs discovered in step 08.

## What replaces what

| Existing | v2 | Change |
|----------|-----|--------|
| `new-ui/rendering/overlay-host.ts` | `v2/rendering/overlay-host.ts` | Same API, adapted for v2 types |
| `new-ui/rendering/placeholder-island.tsx` | `v2/rendering/placeholder-island.tsx` | Same API |
| `new-ui/rendering/inject-styles.ts` | `v2/rendering/inject-styles.ts` | Same `adoptedStyleSheets` approach |
| `new-ui/rendering/editor-ui.css` | `v2/rendering/editor-ui.css` | Updated `@source` path, potentially simplified |

## Tailwind reference

The Tailwind setup follows patterns from `@enonic/ui` and `app-contentstudio`:

- **@enonic/ui** exports `preset.css` (design tokens as `@theme` block), `base.css`, `utilities.css`
- **page-editor** consumes `@enonic/ui/preset.css` for token alignment
- **Vite plugin** (`@tailwindcss/vite`) processes the CSS during JS build
- **`?inline` import** bundles the processed CSS as a string for runtime injection
- **No `tailwind.config.js`** — Tailwind v4 uses CSS-based configuration

## Dependencies

None from other v2 modules. Uses Preact for rendering and Tailwind/CSS for styling.

## Verification

- Storybook visual check: create a minimal story that renders content inside both an overlay host and a placeholder island. Verify:
  - Tailwind classes resolve correctly (colors, spacing, typography)
  - `@enonic/ui` design tokens work (semantic colors, font families)
  - Dark mode tokens work
  - Styles don't leak outside the shadow root
  - Customer page styles don't leak into the shadow root
- Run `pnpm check`
- Run `pnpm build:dev` — verify CSS is processed and bundled correctly
