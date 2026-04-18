# 03 — Load-Component Flow & Data-Access API

Covers the component-load message shape and the read-only instance API that lets Content Studio's in-iframe integration code find components, DOM nodes, and page config without depending on a legacy ItemView tree.

Scope: gaps **G1** and **G21** from `docs/compatibility.md`.

---

## Background — how the load flow actually works

Critical architectural detail: CS's `EditorEventHandler` runs **inside the iframe** (loaded alongside `@enonic/page-editor` via `page-editor.ts`). It is not parent-side code. The load flow is iframe-resident:

1. CS parent fires `{type: 'load', path, existing}` to the iframe.
2. v2's adapter (`src/transport/adapter.ts:51–54`) flips `loading: true` on the registry record and invokes `options.onComponentLoadRequest(path, existing)`.
3. CS's callback (still inside the iframe) builds a component URL, calls `fetch()`, inspects the response, and either swaps HTML in place or requests a full page reload.
4. CS calls `editor.notifyComponentLoaded(path)` or `editor.notifyComponentLoadFailed(path, reason)` to signal the parent.

Legacy's flow did the same thing but through a richer `view: ItemView` payload and the global `PageEditor.getContent()`. Both of those are gone in v2, and neither should come back — but CS still needs a handful of read-only access paths.

---

## G1 — `load` message gets `existing` back

### Decision

`existing` is a required field on incoming `load` and a required second argument to the callback.

```ts
// src/protocol/messages.ts
| {type: 'load'; path: ComponentPath; existing: boolean}

// src/init.tsx — EditorOptions (defined in 02-PREVIEW-MODE.md)
export type EditorOptions = {
  hostDomain?: string;
  onComponentLoadRequest?: (path: ComponentPath, existing: boolean) => void;
};
```

### Why `existing` is load-bearing

Legacy CS uses it at `~/repo/app-contentstudio/modules/app/src/main/resources/assets/js/EditorEventHandler.ts:62–71`:

```ts
if (!isExisting) {
  const hasContributions = response.headers.has('X-Has-Contributions');
  if (hasContributions && !this.hasSameComponentOnPage(...)) {
    PageEditor.notify(EditorEvents.PageReloadRequest);
    return;
  }
}
```

A newly-added component whose portal controller declares `<portal:contributions>` in `<head>` or `<script>` can't be hot-swapped — the contributions don't exist on the page yet. Only a full page reload makes the portal inject them. The `!existing && X-Has-Contributions && !sameDescriptorElsewhere` triple gate drives real runtime correctness; losing it causes broken CSS/JS on newly-added parts.

### Why `view` (legacy ItemView reference) does NOT come back

Legacy's `ComponentLoadRequest` carried `{view: ItemView, isExisting}`. The `view` reference was a live node in legacy's ItemView tree that CS used to read `getType()`, read `getParentItemView()`, and call `replaceWith(newView)`. v2 has no ItemView tree. CS's needs from `view` — component type, parent path, DOM element — are all recoverable from the read-only access API below, without exposing a mutable legacy object.

---

## G21 — Replacing `getContent()` with narrow read-only accessors

### Decision

Expose four read-only accessors on `PageEditorInstance`:

```ts
// src/init.tsx

export type PageEditorInstance = {
  // lifecycle (topic 1)
  destroy: () => void;
  notifyComponentLoaded: (path: ComponentPath) => void;
  notifyComponentLoadFailed: (path: ComponentPath, reason: string) => void;
  requestPageReload: () => void;

  // data access (topic 3 — G21)
  getConfig: () => PageConfig | undefined;
  getRecord: (path: ComponentPath) => ComponentRecord | undefined;
  getElement: (path: ComponentPath) => HTMLElement | undefined;
  findRecordsByDescriptor: (descriptor: string) => readonly ComponentRecord[];
};
```

`ComponentRecord` is already defined in `src/state/registry.ts:5–14` (existing type, no change):

```ts
export type ComponentRecord = {
  path: ComponentPath;
  type: ComponentType;                        // 'page' | 'region' | 'text' | 'part' | 'layout' | 'fragment'
  element: HTMLElement | undefined;            // the mounted DOM node, if any
  parentPath: ComponentPath | undefined;
  children: ComponentPath[];
  empty: boolean;
  error: boolean;
  descriptor: string | undefined;              // controller key (parts / layouts) or fragment key
  fragmentContentId: string | undefined;       // fragment-only
  loading: boolean;
};
```

Re-export `ComponentRecord` from `src/index.ts` so CS can type its callbacks.

### Accessor semantics

| Accessor | Returns | Null when |
|---|---|---|
| `getConfig()` | The last `PageConfig` received via `init` message | No `init` has arrived yet |
| `getRecord(path)` | Snapshot of the record at `path` | Path not in registry |
| `getElement(path)` | `getRecord(path)?.element` | Path not in registry, or record has no mounted element |
| `findRecordsByDescriptor(descriptor)` | All records whose `descriptor === descriptor` argument | Always returns an array; empty if no matches |

Implementation: these are thin wrappers over the existing registry getters in `src/state/registry.ts:25,29` and `$registry.get()`. No new state; no writes.

### Why `getElement(path)` as a separate method

Shorthand for the most common access pattern. CS will call this dozens of times per flow; `editor.getElement(path)` beats `editor.getRecord(path)?.element` on every dimension (clarity, keystrokes, discoverability).

### Why `findRecordsByDescriptor` is on the instance

Legacy's `EditorEventHandler.hasSameComponentOnPage(path)` does a parent-side scan of `PageState` for components with the same descriptor key. In v2, the same information lives in the iframe's `$registry`. Rather than duplicating the iteration logic in CS, expose the walk as a library helper. Tiny generic primitive; no XP knowledge leaks into page-editor.

### Why nothing else is exposed

Anything else CS might want (a full `PageDescriptor` tree, controller lists, theme state) is either:
- already pushed into CS via the reverse direction (CS sends `page-state`, so CS already has it), or
- not needed by the load-component flow in particular.

The four accessors above are the minimum that closes G21; anything more is YAGNI.

---

## What page-editor deliberately does NOT absorb from `EditorEventHandler`

The user-facing question came up: "should page-editor cover most of `EditorEventHandler` so CS doesn't re-implement it?" Answer: partial. The table below is the explicit split.

| `EditorEventHandler` responsibility | Owner | Rationale |
|---|---|---|
| `UriHelper.getComponentUri(contentId, path, RenderingMode.EDIT)` | **CS** | Format is XP-specific; `UriHelper`/`RenderingMode` are lib-contentstudio internals. Page-editor must stay URL-agnostic. |
| `fetch(componentUrl)` | **CS** | Trivial; wrapping adds no value. |
| `response.headers.has('X-Has-Contributions')` | **CS** | XP portal convention between CS and the renderer. Not page-editor's concern. |
| `hasSameComponentOnPage(path)` duplicate-descriptor scan | **Page-editor** (via `findRecordsByDescriptor`) | Registry walk is generic. |
| Loading spinner on/off | **Page-editor** (automatic) | `load` message flips `loading: true`; placeholder renders spinner from state. No CS work. |
| `wrapLoadedFragmentHtml` — DOMPurify sanitize + `data-portal-component-type="fragment"` wrapper | **CS** | DOMPurify is heavy; data-attribute naming is XP convention. |
| DOM swap (`element.replaceWith(newElement)`) | **CS** (but uses `editor.getElement(path)`) | Native DOM API works; v2's MutationObserver re-reconciles automatically. |
| `notify(ComponentLoaded \| ComponentLoadFailed)` | **Page-editor** | `editor.notifyComponentLoaded(path)` / `notifyComponentLoadFailed(path, reason)`. |

Net: CS's iframe-side handler shrinks by roughly 40% without pulling XP-specific concepts into the page-editor package.

---

## CS migration example

Before (current `EditorEventHandler.ts:27–46`):

```ts
public loadComponentView(view: ItemView, isExisting: boolean): void {
  const path = view.getPath();
  if (view instanceof ComponentView) {
    const content = PageEditor.getContent();
    const componentUrl: string = UriHelper.getComponentUri(
      content.getContentId().toString(),
      this.convertContentPath(path),
      RenderingMode.EDIT,
    );
    this.loadComponent(view, componentUrl, isExisting)
      .then(() => PageEditor.notify(EditorEvents.ComponentLoaded, {path}))
      .catch((reason) => PageEditor.notify(EditorEvents.ComponentLoadFailed, {path, reason}));
  }
}
```

After (v2 callback, still inside iframe):

```ts
onComponentLoadRequest: async (path, existing) => {
  const contentId = editor.getConfig()?.contentId;
  const record = editor.getRecord(path);
  const element = editor.getElement(path);
  if (contentId == null || record == null || element == null) return;

  const url = UriHelper.getComponentUri(contentId, path, RenderingMode.EDIT);
  try {
    const response = await fetch(url);

    const sameDescriptorElsewhere = record.descriptor != null
      && editor.findRecordsByDescriptor(record.descriptor).some((r) => r.path !== path);

    if (!existing && response.headers.has('X-Has-Contributions') && !sameDescriptorElsewhere) {
      editor.requestPageReload();
      return;
    }

    const html = await response.text();
    const newElement = record.type === 'fragment' ? wrapFragmentHtml(html) : parseHtml(html);
    element.replaceWith(newElement);
    editor.notifyComponentLoaded(path);
  } catch (reason) {
    editor.notifyComponentLoadFailed(path, String(reason));
  }
}
```

The old `EditorEventHandler` class survives mostly for `wrapFragmentHtml` (DOMPurify + wrapper) and the `UriHelper` call — both genuinely CS-owned.

---

## Implementation checklist

1. Change `load` payload in `src/protocol/messages.ts:66` to `{type: 'load'; path: ComponentPath; existing: boolean}`.
2. Update adapter in `src/transport/adapter.ts:51–54` to pass `message.existing` through to `callbacks?.onComponentLoadRequest?.(message.path, message.existing)`.
3. Update `EditorOptions.onComponentLoadRequest` signature in `src/init.tsx` to `(path, existing) => void`.
4. Add `getConfig` / `getRecord` / `getElement` / `findRecordsByDescriptor` to the returned `PageEditorInstance` in `src/init.tsx`.
5. Export `ComponentRecord` from `src/index.ts` (re-export from `src/state/registry.ts`).
6. Implement `findRecordsByDescriptor` in `src/state/registry.ts` as a new exported function (simple `Object.values($registry.get()).filter(...)`).
7. Tests:
   - `src/protocol/messages.test.ts` — assert `load` shape includes `existing`.
   - `src/transport/adapter.test.ts` — assert callback receives `existing`.
   - `src/init.test.tsx` — assert returned instance exposes new accessors; assert behavior on missing records / before `init`.
   - `src/state/registry.test.ts` — cover `findRecordsByDescriptor` (empty, one match, multiple matches, non-matching descriptors).
8. Update integration stories and `README.md` to show the new shape.

---

## Tradeoffs captured

- **Required `existing`, not optional** — legacy always passed it; no reason for v2 to fall back. Required keeps callers honest.
- **`ComponentRecord` exposed in public type surface** — widens the API, but that's the only way CS can interpret records. Keeping it read-only (`readonly ComponentRecord[]` on `findRecordsByDescriptor`) preserves invariants; page-editor owns mutations.
- **DOM element exposed via `getElement`** — once CS has the node, it can do anything. Legacy already allowed this via `view.getHTMLElement()`. Not a new attack surface.
- **`findRecordsByDescriptor` does O(n) scans** — fine at page-editor scale (typical pages have tens of records, not thousands). If we ever need it hot, add a reverse index in `state/` later.
- **`getConfig()` returns the last-received config, not a live store subscription** — if CS code needs reactivity (e.g. re-render on theme change), subscribe to the nanostore atom directly (`$pageConfig.subscribe(...)` once exposed). For the load-component flow specifically, one-shot snapshot is correct.

---

## Cross-references

- Compatibility audit: `docs/compatibility.md` (G1, G21)
- Mount-time options shape: `docs/gaps/02-PREVIEW-MODE.md` (`EditorOptions`)
- Init & lifecycle: `docs/gaps/01-INIT.md`
- Legacy handler: `~/repo/app-contentstudio/modules/app/src/main/resources/assets/js/EditorEventHandler.ts`
- v2 registry: `src/state/registry.ts`
- v2 adapter: `src/transport/adapter.ts`
- v2 protocol: `src/protocol/messages.ts`
- v2 init: `src/init.tsx`

<sub>*Drafted with AI assistance*</sub>
