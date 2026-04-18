# 02 — Preview Mode & Mount-Time Options

Covers the preview-mode entry point for Content Studio (the former `PageEditor.init(false)` path) and the shared mount-time options shape that carries `hostDomain` to both `initPageEditor` and `initPreview`.

Scope: gap **G23** from `docs/compatibility.md`, plus the `hostDomain` treatment referenced from `01-INIT.md` (G2).

---

## Background

Content Studio ships **two separate iframe bundles**:

- `page-editor.ts` — full live editor (`PageEditor.init(true)` in legacy).
- `page-viewer.ts` — three-line preview bundle (`PageEditor.init(false)` in legacy). Used for the preview iframe where the page renders but is not editable.

Legacy `init(false)` attached exactly one listener: the window click interceptor. Its job was to catch `<a>` clicks inside the previewed page and dispatch `ContentPreviewPathChangedEvent(path)` so CS could route navigation through its own content-preview path handler instead of letting the iframe actually navigate.

v2 had no equivalent entry point. Calling `initPageEditor()` always mounts the full overlay — reconcile, hover, selection, keyboard, drag, context-window-drag — all of which a preview iframe doesn't want, and which inflates the preview bundle from a few KB to hundreds.

---

## G23 — Decision

Add a second public entry point, `initPreview`, dedicated to preview iframes. Tree-shakes every editor-only module out of the preview bundle.

```ts
// src/index.ts — public API

export {initPageEditor, type PageEditorInstance, type EditorOptions} from './init';
export {initPreview, type PreviewInstance, type PreviewOptions} from './preview';
export * from './protocol';
```

### `initPreview`

```ts
// src/preview.ts

export type PreviewOptions = {
  hostDomain?: string;
};

export type PreviewInstance = {
  destroy: () => void;
};

let currentPreview: PreviewInstance | undefined;

export function initPreview(target: Window, options?: PreviewOptions): PreviewInstance {
  if (currentPreview != null) {
    console.warn('[page-editor] initPreview called while already initialized; returning existing instance.');
    return currentPreview;
  }

  const channel = createChannel(target);
  setChannel(channel);

  const stopNavigation = initNavigationInterception(channel, {hostDomain: options?.hostDomain});

  const destroy = (): void => {
    stopNavigation();
    resetChannel();
    currentPreview = undefined;
  };

  currentPreview = {destroy};
  return currentPreview;
}
```

Idempotency follows the same pattern as G22 — module-scoped `currentPreview`, warn on second call, `destroy()` resets.

---

## `EditorOptions` — the unified mount-time options

`initPageEditor`'s third argument becomes a single flat options bag, merging the former `RendererCallbacks` type with the new `hostDomain` option.

```ts
// src/init.tsx — updated signature

export type EditorOptions = {
  hostDomain?: string;
  onComponentLoadRequest?: (path: ComponentPath) => void;
};

export function initPageEditor(
  root: HTMLElement,
  target: Window,
  options?: EditorOptions,
): PageEditorInstance;
```

`RendererCallbacks` is deleted — its single callback is folded into `EditorOptions`. Deprecation is safe: no shipped version of `@enonic/page-editor` uses the new v2 API yet, so there's no external consumer to break.

### Why flat, not nested

Nesting callbacks inside options (`{hostDomain, callbacks: {onComponentLoadRequest}}`) adds a level for no benefit — there's exactly one callback today. If the callback surface grows later, we can reshape then.

### Why a single options object — not a fourth positional arg

`initPageEditor(root, target, callbacks, hostDomain?)` puts two optional values side by side, which is a classic ordering trap. One options bag scales cleanly.

---

## `hostDomain` semantics

| Aspect | Edit mode (`initPageEditor`) | Preview mode (`initPreview`) |
|---|---|---|
| Where CS passes it | `options.hostDomain` at mount time | `options.hostDomain` at mount time |
| Can it change at runtime? | No | No |
| Default if omitted | Treat every link as external; `navigate` fires unfiltered | Same |
| Consumer in v2 | `src/interaction/navigation.ts` — classifies internal vs external links | Same (shared module) |

Both entry points pipe `hostDomain` into the same `initNavigationInterception(channel, {hostDomain})` function. The navigation module stops being a click-forwarder and becomes a classifier — external URLs are not intercepted, same-page anchors are not intercepted, downloads are not intercepted. Full classification logic is specified in gap G20.

### Why not expose `hostDomain` via an `init` message for edit mode

Consistency. Symmetry. And accuracy: `hostDomain` is a mount-time constant for the iframe's JS lifetime. Async delivery via postMessage is the wrong shape for a constant. The `init` message shape should stay focused on runtime-mutable page state.

---

## CS migration

### Edit bundle

Before (legacy):
```ts
// page-editor.ts
import {PageEditor, EditorEvents, EditorEvent, type ItemView} from '@enonic/page-editor';
import '@enonic/page-editor/styles.css';
import {EditorEventHandler} from './EditorEventHandler';

PageEditor.init(true);
const eventHandler = new EditorEventHandler();
PageEditor.on(EditorEvents.ComponentLoadRequest, (event) => {
  const {view, isExisting} = event.getData();
  eventHandler.loadComponentView(view, isExisting);
});
```

After (v2):
```ts
// page-editor.ts
import {initPageEditor, type ComponentPath} from '@enonic/page-editor';
import '@enonic/page-editor/styles.css';
import {EditorEventHandler} from './EditorEventHandler';

const eventHandler = new EditorEventHandler();

const editor = initPageEditor(document.body, window.parent, {
  hostDomain: `${window.location.protocol}//${window.location.host}`,
  onComponentLoadRequest: (path: ComponentPath) => {
    eventHandler.loadComponentView(path);
  },
});
```

Note the signature of `onComponentLoadRequest` lost `view` and `isExisting`. That's gap G1 — handled separately; for now, CS migration assumes `path`-only and we'll expand it when G1 is resolved.

### Preview bundle

Before (legacy):
```ts
// page-viewer.ts
import {PageEditor} from '@enonic/page-editor';
PageEditor.init(false);
```

After (v2):
```ts
// page-viewer.ts
import {initPreview} from '@enonic/page-editor';
initPreview(window.parent, {
  hostDomain: `${window.location.protocol}//${window.location.host}`,
});
```

---

## Build / bundling

`vite.config.ts` must expose both entry points. Since v2 uses `vite-plus` with a lib build, add a second entry alongside the existing one:

```ts
// conceptual
build: {
  lib: {
    entry: {
      index: 'src/index.ts',          // full package export
      preview: 'src/preview.ts',      // optional deep-import for extreme tree-shaking
    },
    // ...
  },
}
```

In practice, consumers will import `{initPreview}` from the main `@enonic/page-editor` entry and rely on ES module tree-shaking to drop the editor code. The second `entry` is a defensive safety net — if CS's bundler doesn't tree-shake well, CS can deep-import `@enonic/page-editor/preview` for a guaranteed-minimal bundle. Decide in the build-config PR whether we ship the deep-import path or rely on tree-shaking.

---

## Implementation checklist

1. Create `src/preview.ts` with `initPreview`, `PreviewOptions`, `PreviewInstance`.
2. Create `src/init.tsx` updates: rename `RendererCallbacks` → `EditorOptions`; add `hostDomain` field; fold `onComponentLoadRequest` into options; change third arg.
3. Update `src/interaction/navigation.ts` to accept `{hostDomain}` and classify links (implementation lives in gap G20's doc).
4. Export `initPreview` and `EditorOptions`/`PreviewOptions`/`PreviewInstance` from `src/index.ts`; drop `RendererCallbacks` export.
5. Update `src/init.test.tsx` to use the new options shape.
6. Add `src/preview.test.ts` — cover idempotency, link interception, destroy teardown, `hostDomain` classification hook (minimal test; full G20 coverage lives there).
7. Update `README.md` and storybook integration stories.
8. `vite.config.ts` — decide and implement entry-point strategy (single entry + tree-shaking vs. explicit `preview` sub-entry).

---

## Tradeoffs captured

- **Breaking change to `initPageEditor` signature**. `options` replaces `callbacks`. v2 hasn't shipped; CS hasn't migrated; blast radius is zero. Accepted.
- **`RendererCallbacks` deleted**. Same rationale. Accepted.
- **Two public entry points to maintain**. They share ~95% of their transport + navigation code via the same modules; the cost is two `README.md` paragraphs and a few extra test files. Worth it for the bundle-size win.
- **`hostDomain` is optional**. If CS forgets to pass it, link classification degrades to "everything fires `navigate`". Not a silent failure in prod — G20 will add a dev-mode `console.warn` if `hostDomain` is missing and `navigate` is about to fire for something that looks external.

---

## Cross-references

- Compatibility audit: `docs/compatibility.md` (G23)
- Init & lifecycle: `docs/gaps/01-INIT.md` (G2 — why `hostDomain` is not in `PageConfig`)
- Navigation classification (uses `hostDomain`): gap G20, doc to be written
- Legacy preview bundle: `~/repo/app-contentstudio/modules/app/src/main/resources/assets/js/page-viewer.ts`
- Legacy link interceptor: `.worktrees/master/src/main/resources/assets/js/page-editor/PageEditor.ts:155–172`
- v2 navigation: `src/interaction/navigation.ts`
- v2 init: `src/init.tsx`
- v2 transport: `src/transport/`

<sub>*Drafted with AI assistance*</sub>
