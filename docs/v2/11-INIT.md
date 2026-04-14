# Step 11 — Init

> SPEC ref: [init.ts](../SPEC-v2.md#inits), [persistence.ts](../SPEC-v2.md#persistencets), [Public API](../SPEC-v2.md#public-api)

## Goal

Wire all modules together, add selection persistence, define the public API, and remove all legacy code. This is the final integration step — after it, the v2 module is complete and the legacy `page-editor/` + transitional `new-ui/` directories can be deleted.

## Scope

```
src/main/resources/assets/js/v2/
├── persistence.ts   ← selection session storage
├── init.ts          ← entry point, wires everything
└── (update) index.ts at package root — re-export protocol/ + initPageEditor

Legacy removal:
├── DELETE src/main/resources/assets/js/page-editor/    ← entire legacy directory
├── DELETE src/main/resources/assets/js/new-ui/         ← entire transitional directory
├── UPDATE src/main/resources/assets/js/index.ts        ← new exports
├── UPDATE src/main/resources/assets/css/main.less      ← drop legacy LESS imports
├── UPDATE package.json                                 ← drop legacy dependencies
├── UPDATE vite.config.ts                               ← drop legacy build config
```

### persistence.ts

```ts
function initSelectionPersistence(channel: Channel): () => void;
```

- Subscribes to `$selectedPath` -> writes to `sessionStorage` keyed by content ID from `$config`
- On init: reads stored path, validates it exists in `$registry`, if valid sets `$selectedPath` and sends `'select'`
- Scroll-into-view is handled by `SelectionHighlighter` component (not persistence)
- Skips root path unless page is a fragment
- Returns unsubscribe cleanup function

### init.ts

```ts
type RendererCallbacks = {
  onComponentLoadRequest?: (path: ComponentPath) => void;
};

type PageEditorInstance = {
  destroy: () => void;
  notifyComponentLoaded: (path: ComponentPath) => void;
  notifyComponentLoadFailed: (path: ComponentPath, reason: string) => void;
  requestPageReload: () => void;
};

function initPageEditor(
  root: HTMLElement,
  target: Window,
  callbacks?: RendererCallbacks,
): PageEditorInstance;
```

`root` is the page body element. `target` is `window.parent` (Content Studio frame).

**Initialization sequence:**

1. Create channel (`createChannel(target)`)
2. Store channel via `setChannel(channel)`
3. Add `pe-overlay-active` class to body
4. Create overlay host with `<OverlayApp />`
5. Start adapter (`createAdapter(channel, { onPageState: (d) => reconcilePage(root, d), onComponentLoadRequest: callbacks?.onComponentLoadRequest })`) — this is where the transport-reconcile cycle is resolved via callback injection
6. Start geometry scheduler
7. Start interaction handlers (hover, selection, keyboard, navigation, component drag, context window drag)
8. Start selection persistence
9. Start MutationObserver on root (triggers `reconcilePage` on meaningful DOM changes)
10. Send `{ type: 'ready' }` message

**MutationObserver:**
- Watches `root` for `childList` changes (subtree, no attributes/characterData)
- Filters out mutations that only add/remove editor-injected elements (placeholder hosts, overlay host)
- On meaningful mutations: calls `reconcilePage()` via `queueMicrotask` to coalesce rapid changes

**Returns `PageEditorInstance`:**
- `destroy()` — tears down in reverse order, resets all store atoms to initial values
- `notifyComponentLoaded(path)` — sends `{ type: 'component-loaded', path }`
- `notifyComponentLoadFailed(path, reason)` — sends `{ type: 'component-load-failed', path, reason }`
- `requestPageReload()` — sends `{ type: 'page-reload-request' }`

### Public API exports

Update `src/main/resources/assets/js/index.ts`:

```ts
// Protocol types (for Content Studio)
export * from './v2/protocol';

// Entry point
export { initPageEditor } from './v2/init';
export type { PageEditorInstance, RendererCallbacks } from './v2/init';
```

Content Studio imports:
```ts
import { type IncomingMessage, type OutgoingMessage, type ComponentPath, initPageEditor } from '@enonic/page-editor';
```

### Legacy removal

**Directories to delete:**
- `src/main/resources/assets/js/page-editor/` — entire legacy jQuery/class-based codebase (~28 files)
- `src/main/resources/assets/js/new-ui/` — entire transitional Preact layer (~50 files)

**Dependencies to drop from `package.json`:**
- `jquery` (~3.7.1)
- `jquery-simulate` (^1.0.2)
- `jquery-ui` (^1.14.1)
- `mousetrap` (^1.6.5)
- `q` (^1.5.1) — legacy promise library
- `dompurify` (^3.3.1) — was used for text editing sanitization
- `@types/jquery`, `@types/jqueryui`, `@types/mousetrap`, `@types/q`, `@types/ckeditor`
- `@rollup/plugin-inject` — was used to inject jQuery globals

**Dev dependencies to evaluate:**
- `@enonic/lib-admin-ui` (file:.xp/dev/lib-admin-ui) — remove if no remaining imports
- `@enonic/lib-contentstudio` (file:.xp/dev/lib-contentstudio) — remove if no remaining imports

**LESS removal:**
- `src/main/resources/assets/css/main.less` — remove legacy LESS imports from lib-admin-ui/lib-contentstudio
- Evaluate whether `main.less` is still needed at all. If v2 uses only Tailwind in shadow DOM, the global LESS stylesheet may be reduced to just the `pe-overlay-active` body class rule, or dropped entirely
- If LESS is dropped: remove `less` and related PostCSS deps from devDependencies

**Build config:**
- `vite.config.ts` — remove `@rollup/plugin-inject` (jQuery injection), remove lib-admin-ui/lib-contentstudio resolve aliases if dependencies are fully removed, potentially simplify to single build target if LESS is dropped

**TypeScript import aliases:**
- Add `paths` to `tsconfig.app.json` and `tsconfig.test.json` so `react` resolves to `preact/compat` at the type level (matching the existing Vite `resolve.alias`):
  ```json
  "paths": {
    "react": ["./node_modules/preact/compat"],
    "react-dom": ["./node_modules/preact/compat"],
    "react/jsx-runtime": ["./node_modules/preact/jsx-runtime"],
    "react/jsx-dev-runtime": ["./node_modules/preact/jsx-dev-runtime"]
  }
  ```
- Switch all `from 'preact/compat'` imports to `from 'react'` across v2 (aligns with `@enonic/ui` convention)
- Evaluate changing `jsxImportSource` from `"preact"` to `"react"` — the alias makes them equivalent, and `"react"` gives standard `ReactNode`/`ReactElement` types without the compat layer

**Storybook:**
- `.storybook/preview.tsx` — remove jQuery global setup (`globalThis.$ = jQuery`)
- Update stories to use only v2 imports

## What replaces what

| Existing | v2 | Change |
|----------|-----|--------|
| `new-ui/init.tsx` | `v2/init.ts` | Standalone init, no bridge/coexistence |
| `new-ui/persistence/selection-storage.ts` | `v2/persistence.ts` | Drop SessionStorageHelper from lib-contentstudio |
| `new-ui/bridge.ts` | Removed entirely | Direct store access replaces bridge calls |
| `new-ui/coexistence/ownership.ts` | Removed entirely | v2 owns everything |
| `new-ui/constants.ts` | Removed (constants inlined or in config) | |
| `page-editor/PageEditor.ts` (main class) | `initPageEditor` function | Class -> function |
| `index.ts` (exports PageEditor class + component views) | `index.ts` (exports protocol types + initPageEditor) | Simplified public API |

## Adapting from existing code

**persistence.ts:** Existing `persistence/selection-storage.ts` uses `SessionStorageHelper` from lib-contentstudio. v2 uses `sessionStorage` directly — the helper was just a wrapper.

**init.ts:** Existing `init.tsx` has the same concept (create overlay, start handlers, return cleanup) but is coupled to bridge.ts and coexistence.ts. v2 version is simpler — no coexistence, no bridge, no PageView reference.

**MutationObserver:** This is new in v2. The existing code triggers reconciliation via bus events. v2 observes the DOM directly, which is more reliable (catches any DOM change, not just ones communicated via events).

## Dependencies

All v2 modules — this is the integration point.

## Verification

- **Integration test:** Full lifecycle — init -> receive `init` message -> parse page -> select/deselect -> context menu -> drag -> destroy
- **Persistence test:** Select component, destroy, re-init, verify selection restored
- **MutationObserver test:** Mutate DOM, verify reconciliation triggered and registry updated
- **Destroy test:** Call destroy, verify all listeners removed, atoms reset, no memory leaks
- **Build test:** `pnpm build:dev` and `pnpm build:prod` both succeed
- **Type check:** `pnpm check:types` — verify all exports are correctly typed
- **Storybook:** `pnpm build-storybook` — verify stories build without legacy imports
- **Dependency check:** Verify no remaining imports from `@enonic/lib-admin-ui` or `@enonic/lib-contentstudio` in the codebase (unless explicitly kept for data utilities)
- Run `pnpm check`
