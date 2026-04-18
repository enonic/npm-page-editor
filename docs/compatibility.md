# Legacy ↔ v2 Compatibility

Audit of the legacy `@enonic/page-editor` (master branch, worktree at `.worktrees/master/`) against the current v2 implementation (`src/`). The goal is a complete picture of what changed in the public contract so Content Studio can be re-wired against v2 and every surviving gap is visible.

Sources reviewed:
- **Legacy** — `.worktrees/master/src/main/resources/assets/js/page-editor/` (`PageEditor.ts`, `LiveEditPage.ts`, all `ItemView` subclasses, event classes).
- **v2** — `src/init.tsx`, `src/transport/adapter.ts`, `src/protocol/messages.ts`, `src/interaction/*`, `src/components/*`, `src/persistence.ts`, `src/i18n/*`.

Paths below are clickable: `file:line`.

---

## 1. Initialization — what was, what is, what's gone

### Legacy call signature

```ts
PageEditor.init(editMode: boolean): void
```

- `editMode = true` → `RenderingMode.EDIT`. Full editor. `.worktrees/master/src/main/resources/assets/js/page-editor/PageEditor.ts:267`
- `editMode = false` → `RenderingMode.INLINE`. Preview-only iframe with link interception. Same file, line 271.
- `init()` was **idempotent-by-throw**: calling twice raised an error (`PageEditor.ts:268`).

#### What `init()` did unconditionally

| Step | What | Where |
|------|------|-------|
| `initializeGlobalState()` | Put jQuery into `Store.instance()` under `$`; set StyleHelper prefix for ItemView placeholders. | `PageEditor.ts:245–248` |
| `initializeEventBus()` | Get `IframeEventBus.get()` singleton, register `parent` window as receiver (`setId('iframe-bus')`), pre-register ~20 event/content classes so the bus can serialize them across the iframe boundary (ContentSummary, ComponentPath, each component type, each event type, etc.). | `PageEditor.ts:199–243` |
| `windowClickListener` | `window.click` handler that intercepts `<a>` clicks; if internal (same origin, inside XP, not same-page, not a download), dispatches `ContentPreviewPathChangedEvent(path)` using `UriHelper` to normalize. | `PageEditor.ts:155–172`, attached at `328–331` |

#### What `editMode=true` added on top

| Step | What | Where |
|------|------|-------|
| `new LiveEditPage()` | Registered listeners for `InitializeLiveEditEvent` and `SkipLiveEditReloadConfirmationEvent`. The **real editor tree is only built on receipt of `InitializeLiveEditEvent` from the parent** — `init()` by itself does nothing visible. See `LiveEditPage.ts:131–186`. | `PageEditor.ts:272–274` |
| `documentKeyListener` | `document.keypress/keydown/keyup` — forwards Ctrl/Cmd/Alt + key and F2 to the parent as `IframeEvent('editor-modifier-pressed')`; also prevents default when the parent has a matching KeyBinding. | `PageEditor.ts:126–147`, attached `320–323` |
| `windowLoadListener` | `window.load` → fires `IframeEvent('editor-iframe-loaded')` on the bus. | `PageEditor.ts:149–153`, attached `324–327` |

`editMode=false` added **nothing** beyond the unconditional setup. Its only purpose was the link-click interceptor.

### v2 call signature

```ts
initPageEditor(
  root: HTMLElement,
  target: Window,
  callbacks?: RendererCallbacks,
): PageEditorInstance
```

Defined at `src/init.tsx:67`. Always wires the full editor — there is no mode flag.

What it does on every call (`src/init.tsx:67–136`):

1. `createChannel(target)` — typed postMessage channel to `target` (expected to be `window.parent`).
2. `setChannel(channel)` — stores globally so action handlers can send.
3. Adds body class `pe-overlay-active`.
4. Mounts the overlay host (Shadow DOM root) with `<OverlayApp />`.
5. Starts every subsystem: geometry, hover, selection, keyboard, navigation interception, component drag, context-window drag, adapter, DOM MutationObserver, persistence.
6. Sends `{type: 'ready'}` over the channel.
7. Returns an instance: `{destroy, notifyComponentLoaded, notifyComponentLoadFailed, requestPageReload}`.

Key architectural shift: **v2 is driven by `init`/`page-state` messages, not by an ItemView tree the editor builds from the DOM.** Legacy walked the DOM into a typed tree of ItemView subclasses on `InitializeLiveEditEvent`; v2 parses the DOM lazily via `src/parse/` and reconciles overlays from state atoms whenever a `page-state` message arrives.

### Mode equivalence — the missing piece

There is **no v2 equivalent of `init(false)` / INLINE mode**. Today, calling `initPageEditor()` always mounts the full overlay, attaches hover/selection/keyboard handlers, and paints placeholders. A pure preview iframe that only needs `<a>` click interception has no supported path.

---

## 2. How to initialize from Content Studio today

The old flow was:

```ts
PageEditor.init(true);                                    // attach listeners
// CS later dispatches InitializeLiveEditEvent(content, pageJson, userJson, …)
// LiveEditPage builds the ItemView tree and the editor becomes usable
PageEditor.on(EditorEvents.ComponentLoadRequest, handler);
```

The v2 flow is:

```ts
import {initPageEditor, type ComponentPath, type PageEditorInstance} from '@enonic/page-editor';
import '@enonic/page-editor/styles.css';

const editor: PageEditorInstance = initPageEditor(document.body, window.parent, {
  onComponentLoadRequest: (path: ComponentPath) => {
    eventHandler.loadComponentView(path);
  },
});
```

After the handshake (editor sends `ready`), Content Studio must **post an `init` message** containing `PageConfig` (`src/protocol/messages.ts:12–26`) — `contentId`, `pageName`, `pageIconClass`, `locked`, `modifyPermissions`, `pageEmpty`, `pageTemplate`, `fragment`, `fragmentAllowed`, `resetEnabled`, `phrases`, `theme`, `langDirection`. Until `init` arrives, v2 queues all other incoming messages (`src/transport/adapter.ts:94–110`).

Then CS must drive the page content by sending `page-state` messages carrying a `PageDescriptor` tree. v2 reconciles the DOM against this descriptor (`src/reconcile.tsx`). Content Studio no longer fires individual add/remove/move events at the editor — it just sends the new page snapshot and the reconciler figures it out.

Lifecycle methods on the returned instance replace `PageEditor.notify(...)`:

| Legacy | v2 |
|--------|----|
| `PageEditor.notify(EditorEvents.PageReloadRequest)` | `editor.requestPageReload()` |
| `PageEditor.notify(EditorEvents.ComponentLoaded, {path})` | `editor.notifyComponentLoaded(path)` |
| `PageEditor.notify(EditorEvents.ComponentLoadFailed, {path, reason})` | `editor.notifyComponentLoadFailed(path, reason)` |
| `PageEditor.on(EditorEvents.ComponentLoadRequest, handler)` | `callbacks.onComponentLoadRequest` passed to `initPageEditor` |
| `PageEditor.on(…other events…)` | Must read outgoing `postMessage` on CS side; no JS event-bus bridge exists. |

`isInitialized()` and `getContent()` have **no direct v2 equivalent**. v2 tracks its initialized state internally in the adapter; CS does not read it back.

---

## 3. Event catalog — legacy vs v2

The legacy wire format was `IframeEvent` serialized across the bus. v2 uses typed postMessage objects. The tables below map every event we found.

### 3.1 Public `EditorEvents` API (`PageEditor.on` surface)

Legacy enum at `.worktrees/master/src/main/resources/assets/js/page-editor/event/EditorEvent.ts`:

| Legacy enum | Legacy payload | v2 equivalent | Status |
|-------------|---------------|---------------|--------|
| `ComponentLoadRequest` | `{view: ItemView, isExisting: boolean}` | `callbacks.onComponentLoadRequest(path)` | **PARTIAL** — see gap G1 |
| `PageReloadRequest` | none | `editor.requestPageReload()` outgoing `page-reload-request` | OK |
| `ComponentLoaded` | `{path: ComponentPath}` | `editor.notifyComponentLoaded(path)` outgoing `component-loaded` | OK |
| `ComponentLoadFailed` | `{path, reason: Error}` | `editor.notifyComponentLoadFailed(path, reason)` outgoing `component-load-failed` | **PARTIAL** — `reason` is a string in v2 (`messages.ts:97`); `Error` object is lost |

### 3.2 CS → editor (incoming) — legacy iframe events vs v2 messages

Legacy handlers in `LiveEditPage.ts`; v2 handlers in `src/transport/adapter.ts:24–88`.

| Legacy event | v2 message `type` | Behavior in v2 | Status |
|--------------|-------------------|----------------|--------|
| `InitializeLiveEditEvent({content, config, hostDomain, pageJson, userJson, principalsJson, projectJson, params: LiveEditParams})` | `init` with `{config: PageConfig}` | Sets page config, lock, modify permissions, theme. | **PARTIAL** — see gap G2 |
| `PageStateEvent({pageJson})` | `page-state` with `{page: PageDescriptor}` | Calls `onPageState` → `reconcilePage()`. | OK (shape differs) |
| `SelectComponentViewEvent({path, silent?})` | `select` with `{path, silent?}` | Sets selected path. `silent` flag is in the type but **adapter ignores it** (`adapter.ts:35–37`). | **PARTIAL** — see gap G3 |
| `DeselectComponentViewEvent({path?})` | `deselect` with `{path?}` | Always clears selection, closes context menu. | OK |
| `AddComponentViewEvent({componentPath, componentType})` | `add` | **No-op** in adapter (`adapter.ts:44–48`). v2 expects CS to follow with `page-state`. | **ARCHITECTURAL** — intentional, but see G4 |
| `RemoveComponentViewEvent({componentPath})` | `remove` | **No-op**. | Same as above |
| `MoveComponentViewEvent({from, to})` | `move` | **No-op**. | Same as above |
| `DuplicateComponentViewEvent({componentPath})` | `duplicate` | **No-op**. | Same as above |
| `ResetComponentViewEvent({componentPath})` | `reset` | **No-op**. | Same as above |
| `LoadComponentViewEvent({componentPath, isExisting})` | `load` with `{path}` | Marks record `loading: true`, calls `onComponentLoadRequest(path)`. | **PARTIAL** — `isExisting` dropped (G1) |
| `SetComponentStateEvent({path, processing})` | `set-component-state` | Updates record `loading` flag. | OK |
| `SetPageLockStateEvent({isToLock})` | `set-lock` | Sets locked atom. | OK (name change) |
| `SetModifyAllowedEvent({isModifyAllowed})` | `set-modify-allowed` | Sets flag; forces lock when `false`. | OK |
| `CreateOrDestroyDraggableEvent({type, isCreate})` | `create-draggable` / `destroy-draggable` | **No-op** in v2 (`adapter.ts:79–81`). v2 owns its own drag palette via `context-window-drag.ts`. | **INCOMPATIBLE** — see G5 |
| `SetDraggableVisibleEvent({type, isVisible})` | `set-draggable-visible` | **No-op**. | Same |
| `UpdateTextComponentViewEvent({componentPath, text, origin})` | *(none)* | — | **MISSING** — see G6 |
| `IframeBeforeContentSavedEvent` | *(none)* | v2 persists selection on every change, not on save. | **MISSING** — see G7 |
| `MinimizeWizardPanelEvent` | *(none)* | Legacy listened but no behavior found for it inside the iframe. | Likely obsolete |
| `SkipLiveEditReloadConfirmationEvent({skip})` | *(none)* | Legacy skipped the `beforeunload` confirm on the next reload. | **MISSING** — see G8 |
| *(new in v2)* | `set-theme` | Applies theme (`theme-sync.ts`). | v2-only |
| *(new in v2)* | `page-controllers` with `{controllers: PageController[]}` | Populates page descriptor selector. | v2-only |

### 3.3 Editor → CS (outgoing) — legacy iframe events vs v2 messages

| Legacy outgoing event | v2 message `type` | Status |
|-----------------------|-------------------|--------|
| `SelectComponentEvent({path, position?, rightClicked?})` | `select` (`messages.ts:81`) | OK — triggered by click / `contextmenu` listener (`src/interaction/selection.ts:56,60`) |
| `DeselectComponentEvent(path)` | `deselect` | OK |
| `MoveComponentEvent(from, to)` | `drag-dropped` (`from, to`) | OK (name differs, see G9) |
| `AddComponentEvent(path, componentType)` | `add` | OK |
| `RemoveComponentEvent(path)` | `remove` | OK |
| `DuplicateComponentEvent(path)` | `duplicate` | OK |
| `ResetComponentEvent(path)` | `reset` | OK |
| `ComponentInspectedEvent(path)` | `inspect` | OK |
| `CreateFragmentEvent(path)` | `create-fragment` | OK |
| `DetachFragmentEvent(path)` | `detach-fragment` | OK |
| `EditTextComponentViewEvent(path)` | `edit-text` | OK (sends intent only — no in-place editor; see G10) |
| `EditContentFromComponentViewEvent(contentId)` | `edit-content` | OK |
| `SelectPageDescriptorEvent(key)` | `select-page-descriptor` | OK |
| `PageResetEvent()` | *(none — folded into `reset` on page path)* | See G11 |
| `SaveAsTemplateEvent()` | `save-as-template` | OK |
| `PageReloadRequestedEvent()` | `page-reload-request` (via `requestPageReload()`) | OK |
| `ComponentLoadedEvent(path)` | `component-loaded` (via `notifyComponentLoaded`) | OK |
| `LoadComponentFailedEvent(path, reason)` | `component-load-failed` | PARTIAL — reason type narrowed to `string` |
| `ComponentViewDragStartedEvent(path)` | `drag-started` | OK |
| `ComponentViewDragStoppedEvent(path)` | `drag-stopped` | OK |
| `ComponentViewDragDroppedEvent(from, to)` | `drag-dropped` | OK |
| `ComponentViewDragCanceledEvent(view)` | *(none — collapsed into `drag-stopped`)* | Low-impact gap |
| `PageLockedEvent()` / `PageUnlockedEvent()` | *(none)* | G12 — CS may have reacted to these |
| `ItemViewAddedEvent` / `ItemViewRemovedEvent` | *(none)* | Internal legacy events — no migration needed |
| `LiveEditPageInitializationErrorEvent(msg)` | *(none)* | G13 — no error reporting channel |
| `LiveEditPageViewReadyEvent()` | `ready` (fired immediately on `initPageEditor`, not after first `page-state`) | **SEMANTIC DRIFT** — see G14 |
| `IframeEvent('editor-iframe-loaded')` | `iframe-loaded` | OK |
| `IframeEvent('editor-modifier-pressed')` | `keyboard-event` (`key`, `keyCode`, `modifiers`) | OK — shape differs, all fields present |
| `ContentPreviewPathChangedEvent(path)` | `navigate` | OK |
| `IframeBeforeContentSavedEvent` | *(none — fired by editor in legacy?)* | Actually legacy listened to this from parent. |

---

## 4. Capability matrix

Every capability LiveEditPage provided, checked against v2. Verified by reading the listed v2 files.

| # | Capability | Legacy | v2 | File(s) |
|---|-----------|:------:|:--:|---------|
| 1 | **Selection** (click / contextmenu / scroll-into-view / highlight) | ✅ | ✅ | `src/interaction/selection.ts`, `src/components/SelectionHighlighter.tsx` |
| 2 | **Hover / outline** | ✅ | ✅ | `src/interaction/hover.ts`, `src/components/Highlighter.tsx` |
| 3 | **Keyboard: Delete key on selection → remove** | ✅ | ❌ | **missing** — see G15 |
| 4 | **Keyboard: modifier forwarding** | ✅ | ✅ | `src/interaction/keyboard.ts` |
| 5 | **Selection persistence across reloads** | ✅ (session storage, saved on `IframeBeforeContentSavedEvent`) | ✅ (session storage, keyed on `contentId`, saved on selection change) | `src/persistence.ts` |
| 6 | **Component drag (inside page)** | ✅ (jQuery UI sortable) | ✅ (native mouse events) | `src/interaction/component-drag.ts`, `src/interaction/drop-target.ts` |
| 7 | **Palette drag (palette → page)** | ✅ (via `CreateOrDestroyDraggableEvent` from parent) | ✅ (own `context-window-drag`) — but **wire protocol is different** | `src/interaction/context-window-drag.ts` — see G5 |
| 8 | **Nested-layout prevention** | ✅ (`notify.nestedLayouts`) | ✅ | `src/interaction/guards.ts` |
| 9 | **Context menu (right click / long touch)** | ✅ | ✅ right-click; ❓ long-touch | `src/components/ContextMenu/*`, `src/interaction/selection.ts:56` — see G16 |
| 10 | **Context menu actions** (inspect, reset, remove, duplicate, create-fragment, detach-fragment, edit-text, edit-content, select-page-descriptor, save-as-template, insert, select-parent) | ✅ | ~✅ | `src/actions/definitions.ts` — verify `select-parent` and `insert` submenu; see G17 |
| 11 | **Inline text editing** (edit in place) | ✅ (HTMLAreaHelper) | ❌ only sends `edit-text` | G10 |
| 12 | **Text component live update** (parent pushes new HTML) | ✅ (`UpdateTextComponentViewEvent` with `origin` flag to avoid loops) | ❌ | G6 |
| 13 | **Placeholders: empty region** | ✅ | ✅ | `src/components/RegionPlaceholder.tsx` |
| 14 | **Placeholders: empty page (with page descriptor dropdown)** | ✅ | ✅ | `src/components/PagePlaceholderOverlay.tsx`, `src/components/PageDescriptorSelector.tsx` |
| 15 | **Placeholders: empty text / component error / loading** | ✅ | ✅ | `ComponentEmptyPlaceholder.tsx`, `ComponentErrorPlaceholder.tsx`, `ComponentLoadingPlaceholder.tsx` |
| 16 | **Drop indicator / drag placeholder** | ✅ | ✅ | `src/components/DragPlaceholder.tsx`, `DragTargetHighlighter.tsx`, `DragPreview.tsx` |
| 17 | **Fragments: create / detach / nested layout detection** | ✅ | ⚠️ | create/detach events wired; verify `fragmentContainsLayout` handling — G18 |
| 18 | **Page lock / shader overlay** | ✅ (Shader with N/E/S/W panels to prevent scroll) | ✅ (simpler — single overlay) | `src/components/Shader.tsx` — see G19 |
| 19 | **Modify permissions** (forces lock) | ✅ | ✅ | `src/transport/adapter.ts:68–74` |
| 20 | **Load-component on demand** | ✅ `{view, isExisting}` payload | ⚠️ `{path}` only | G1 |
| 21 | **Layout sortable refresh after ComponentLoaded** | ✅ (refreshes jQuery UI sortable) | N/A (v2 drag recomputes from state each drag) | No action needed |
| 22 | **Page-level actions** (reset page, save as template, inspect page) | ✅ | ✅ | `src/actions/definitions.ts` |
| 23 | **Navigation: intercept link clicks, send to CS** | ✅ | ✅ | `src/interaction/navigation.ts` |
| 24 | **Navigation: internal-link classification** (inside XP, not same-page, not download) | ✅ (`UriHelper`) | ❓ — verify `navigation.ts` matches | G20 |
| 25 | **Content data bridge** (`PageEditor.getContent()`) | ✅ | ❌ no equivalent | G21 |
| 26 | **I18n** (strings injected via `CONFIG.phrasesAsJson`) | ✅ | ✅ (`phrases` field on `PageConfig`) | `src/i18n/*` |
| 27 | **Theme / dark mode** | ❌ | ✅ `set-theme` message | v2 addition — verify CS sends it |
| 28 | **Shadow DOM style isolation** | ❌ (leaked into page) | ✅ | `src/rendering/overlay-host.ts` |
| 29 | **Editor chrome / overlay UI** (highlighter, shader, menus) | ✅ (LESS, lives in page DOM) | ✅ (React, lives in Shadow DOM) | Architectural improvement |
| 30 | **Idempotent init / double-init protection** | ✅ (throws) | ❌ calling `initPageEditor` twice silently double-mounts | G22 |
| 31 | **INLINE / preview-only mode** | ✅ (`init(false)`) | ❌ no equivalent | G23 — **blocker for CS preview iframe** |
| 32 | **Cross-iframe serializer registration** (ContentSummary, ComponentPath, etc.) | ✅ (IframeEventBus requires manual registration per class) | N/A (plain JSON over postMessage; types are flat) | Architectural improvement — no action |
| 33 | **Ready handshake** | ✅ `LiveEditPageViewReadyEvent` after tree built | ⚠️ `ready` fires before `init`/`page-state` arrive | G14 |

Legend: ✅ present, ⚠️ partial, ❌ missing, ❓ unverified.

---

## 5. Functional gaps — the to-do list

Items sorted by blast radius. Ship-blockers for Content Studio marked **CRITICAL**.

### G1 — `load` message lost `isExisting` flag and view context **CRITICAL**

Legacy `LoadComponentViewEvent` carried `{componentPath, isExisting}`; legacy `EditorEvent(ComponentLoadRequest)` additionally carried the live `ItemView` reference. v2 `load` (`src/protocol/messages.ts:66`) is `{path}` only.

Content Studio uses `isExisting` to distinguish first-time render from reload. If CS needs that signal, we must extend the message to `{path, existing: boolean}` and the callback to `(path, existing) => void`.

**Fix:** extend `load` message and `RendererCallbacks.onComponentLoadRequest`.

### G2 — `init` config is a strict subset of `InitializeLiveEditEvent` **CRITICAL-ish**

Legacy received `{content, config, hostDomain, pageJson, userJson, principalsJson, projectJson, params: LiveEditParams}`. v2 only accepts `PageConfig` (`src/protocol/messages.ts:12–26`). Specifically missing: `content` (full `ContentSummaryAndCompareStatus`), `userJson`, `principalsJson`, `projectJson`, `hostDomain`, `params`.

Decide case by case what CS actually needs inside the iframe:
- `content` — legacy `getContent()` returned this. If CS code inside the iframe relied on it, we need a bridge (G21).
- `userJson`/`principalsJson` — likely needed for permission checks inside editor; v2 only has `modifyPermissions` bool.
- `hostDomain` — needed by `UriHelper` internal-link classification (G20).
- `params: LiveEditParams` — carried per-text-component initial HTML and other render params. Removing this means v2 cannot normalize text components the way legacy did.

**Fix:** extend `PageConfig` with the fields CS actually reads, or add an `init-context` follow-up message.

### G3 — `select.silent` flag not honoured

`src/protocol/messages.ts:61` declares `silent?: boolean` on incoming `select`, but `adapter.ts:35–37` ignores it. Legacy used `silent` to restore selection on reload without scrolling or firing highlight animation.

**Fix:** pass `silent` down through `setSelectedPath` and have `SelectionHighlighter` skip scroll-into-view when set.

### G4 — `add` / `remove` / `move` / `duplicate` / `reset` are no-ops

v2 relies exclusively on `page-state` for DOM mutations. This is a deliberate architectural change (clean snapshot-based reconcile), but it means:
- CS **must** follow every mutation message with a `page-state` push, or nothing changes visually.
- Legacy-style incremental ItemView mutation is gone.

**Action:** confirm CS already sends `page-state` after every change. If not, either restore per-message behavior or document the requirement clearly in the integration guide.

### G5 — Drag palette protocol mismatch **CRITICAL for drag-from-palette**

Legacy: CS created a DOM helper for each component type via `CreateOrDestroyDraggableEvent` and controlled its visibility via `SetDraggableVisibleEvent`. v2 ignores both. v2 owns its own palette drag via `context-window-drag.ts`, but the parent side needs to know which interaction model to use.

**Fix:** either wire the legacy events to v2's context-window-drag state, or publish v2's new drag protocol and have CS migrate.

### G6 — `UpdateTextComponentViewEvent` missing **CRITICAL if inline text edit was used**

Legacy allowed the parent to push updated text HTML back into a text component, with an `origin` discriminator to avoid echo loops. v2 has no equivalent incoming message. Combined with G10 (no in-place editor), this means v2 cannot currently round-trip text edits.

**Fix:** add `update-text` incoming message `{path, html, origin}` and have `reconcile` apply it without emitting `edit-text` back.

### G7 — Save-time selection persistence hook missing

Legacy saved the selected path to `sessionStorage` on `IframeBeforeContentSavedEvent`. v2's `persistence.ts` writes on every `$selectedPath` change — arguably better, but the precise save-point guarantee is gone.

**Fix:** verify CS doesn't rely on the hook; if it does, add a `before-save` message.

### G8 — `SkipLiveEditReloadConfirmationEvent` missing

Legacy used this to skip the `beforeunload` prompt on the next reload. v2 has no `beforeunload` at all — search `src/` returns nothing. Confirm CS doesn't need it. If the browser-level confirm is handled at CS layer now, close as WONT-FIX.

### G9 — `move` outgoing mapped to `drag-dropped`

Legacy `MoveComponentEvent(from, to)` had one name; v2 fires `drag-dropped` for the same concept. CS message handlers must be updated. Not hard, just a rename.

### G10 — No in-place text editor

v2 sends `edit-text` but no inline editor exists inside the page-editor module. Legacy used `HTMLAreaHelper` to edit inside the iframe. This is a product decision — the new model appears to be "CS opens a wizard for text content" — but needs confirmation.

### G11 — `PageResetEvent()` folded into `reset` on page path

Legacy had a dedicated page-reset event. v2 sends `reset` with the page path. Semantic OK, but CS listener needs the path-based discrimination.

### G12 — No `PageLockedEvent` / `PageUnlockedEvent` outgoing

CS may have wired to these to update its chrome. v2 lock changes are driven by incoming `set-lock` only, so CS already knows. Close unless a specific consumer is found.

### G13 — No init-error outgoing channel

Legacy fired `LiveEditPageInitializationErrorEvent(msg)` when the tree build failed. v2 has no error reporting channel back to CS. If parsing fails mid-reconcile, CS sees nothing.

**Fix:** add `{type: 'error', phase, message}` outgoing, emit it from try/catch around `reconcilePage` and channel dispatch.

### G14 — `ready` semantics drifted

Legacy `LiveEditPageViewReadyEvent` fired after the ItemView tree finished building, i.e. after CS pushed `InitializeLiveEditEvent`. v2 `ready` fires before CS has even sent `init` — it's a "channel open" signal, not a "tree built" signal.

**Fix:** either add a second outgoing event `page-ready` after the first successful `page-state` reconcile, or rename `ready` to `channel-ready` and add `ready` with the legacy semantics.

### G15 — Delete key does not remove selected component **CRITICAL for UX parity**

Legacy bound Delete/Backspace to `RemoveComponentRequest` on every selected `ComponentView` (`.worktrees/master/.../ComponentView.ts:221–241`). v2's `src/interaction/keyboard.ts` forwards keyboard events to CS but doesn't handle delete in-editor.

**Fix:** handle Delete/Backspace in `keyboard.ts` when a component is selected, dispatch `remove` action.

### G16 — Long-touch context menu not verified

Legacy long-press (>1s) on touch devices opened the context menu. v2 wires `contextmenu` which covers right-click and most desktop platforms, but verify long-press behavior on iPad/Android.

### G17 — Context menu actions: `select-parent` and `insert` submenu

Verify both are implemented in v2's `actions/definitions.ts`. Legacy had:
- "Select parent" — navigates selection up the tree
- "Insert" submenu — listed available component types per region

If missing, these are daily-use actions — prioritize.

### G18 — Fragment behavior parity

Legacy had three fragment-specific behaviors worth verifying in v2:
1. Top-level fragments skip insert/remove/duplicate actions (fragment is the whole content).
2. Nested-component `data-type` attributes stripped inside fragments to prevent re-dragging.
3. `fragmentContainsLayout` flag to block nesting.

Audit `src/components/*`, `src/parse/*`, and action definitions.

### G19 — Shader: scroll prevention panels

Legacy `Shader.ts` used five overlays (center + N/E/S/W) so the locked overlay caught scroll events regardless of page scroll position. v2 `Shader.tsx` looks single-overlay. If the locked page is taller than the viewport, check that user can't scroll through the shader.

### G20 — `UriHelper` internal-link classification

Legacy `UriHelper.isNavigatingOutsideOfXP`, `isNavigatingWithinSamePage`, `isDownloadLink` filtered link clicks before dispatching `ContentPreviewPathChangedEvent`. Verify `src/interaction/navigation.ts` has equivalent guards; otherwise v2 will over-report navigation events (e.g. fire `navigate` for anchor links within the same page or for external URLs).

### G21 — `getContent()` has no equivalent

If any CS code inside the iframe did `PageEditor.getContent()` to read content metadata, that path is gone. Either CS already holds this on the parent side (likely) or we need to expose it via a postMessage request/response.

### G22 — Idempotent init not enforced

Calling `initPageEditor` twice on the same root silently double-mounts the overlay and doubles every listener. Legacy threw. Add an early-return with a console warning or an explicit `isInitialized()` exposed on the instance.

### G23 — INLINE / preview-only mode **CRITICAL if CS still mounts editor in preview iframe**

No equivalent of `init(false)`. If the Content Studio preview iframe still loads `@enonic/page-editor` just to get the link-click interceptor, today that path installs the full overlay and listeners it doesn't need.

**Fix options:**
1. Add a `mode: 'edit' | 'preview'` option to `initPageEditor`, gate everything except `navigation.ts` on `mode === 'edit'`.
2. Export a separate `initPreviewNavigation(target)` entry that only wires the navigation interceptor.
3. Confirm CS no longer loads this module in the preview iframe and close as WONT-FIX.

Decision needed before shipping v2 to CS.

---

## 6. Recommended next steps

1. **Gate the v2 ship on these four CRITICAL gaps** — G1 (`load` payload), G5 (palette drag protocol), G15 (Delete key), G23 (INLINE mode).
2. **Resolve config shape** with the CS team — G2 dictates whether we extend `PageConfig` or publish a two-phase init (`init` + `init-context`).
3. **Verify the "every mutation must push `page-state`" contract** with CS (G4) before any CS migration PR.
4. **Sweep verification items** — G16, G17, G18, G19, G20 — each is a ~30 min audit and a tiny patch if missing.
5. **Decide policy on the low-impact gaps** — G6–G14 — some are product decisions, some are two-line fixes.

Once the critical items are closed, the migration path for Content Studio is: swap the `PageEditor.init(true)` call for `initPageEditor(document.body, window.parent, {...})`, replace every `PageEditor.on` with a postMessage listener on `window`, and replace every CS-side `IframeEvent` dispatch with `iframe.contentWindow.postMessage({type: '...'}, '*')` using the types from `@enonic/page-editor`'s protocol export.

<sub>*Drafted with AI assistance*</sub>
