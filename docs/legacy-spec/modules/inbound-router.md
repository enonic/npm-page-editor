# Module: inbound-router (LiveEditPage) — Deep Spec

**File:** `page-editor/LiveEditPage.ts`
**LOC:** 537
**Role:** Iframe-side event router. Subscribes to all wizard-originated events published across the iframe boundary, rehydrates the in-iframe runtime on `InitializeLiveEditEvent`, constructs the root `PageView`, and translates subsequent wizard events into view-tree mutations.

> This file merges the medium-depth module summary with the deep-dive analysis. It is the authoritative reference for LiveEditPage behavior.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Public Surface](#public-surface)
3. [Lifecycle — Construction](#lifecycle--construction)
4. [Lifecycle — Initialization (InitializeLiveEditEvent)](#lifecycle--initialization-initializeliveeditevent)
5. [Lifecycle — Teardown](#lifecycle--teardown)
6. [The 18 Global Listeners](#the-18-global-listeners)
7. [The CreateOrDestroyDraggableEvent Proxy Trick](#the-createordestroydraggableevent-proxy-trick)
8. [Selection Persistence (sessionStorage)](#selection-persistence-sessionstorage)
9. [The Component Load Round-Trip](#the-component-load-round-trip)
10. [Register / Unregister Symmetry](#register--unregister-symmetry)
11. [Error Surfaces](#error-surfaces)
12. [Contract Invariants for Reimplementation](#contract-invariants-for-reimplementation)
13. [Non-Goals](#non-goals)
14. [Suspicious Conditions](#suspicious-conditions)

---

## Purpose

`LiveEditPage` is the iframe-side event router. It subscribes to wizard-originated events published across the iframe boundary, rehydrates the in-iframe runtime (config, i18n, auth, project, page state, content) when `InitializeLiveEditEvent` arrives, constructs the root `PageView`, and translates subsequent wizard events into view-tree mutations (select, add, remove, move, duplicate, reset, text update, lock state, permission change, draggable proxy, visibility toggle, page-state swap, component-load deferral). `PageEditor.init(true)` constructs exactly one instance (`LiveEditPage.ts:65, 119-129, 131-186`).

---

## Public Surface

| Member | Signature | File:Line |
|--------|-----------|-----------|
| `constructor()` | no args | `LiveEditPage.ts:119` |
| `getContent(): ContentSummaryAndCompareStatus \| undefined` | — | `:199` |
| `destroy(win?: Window)` | unsubscribes bootstrap + global listeners | `:203-213` |

All other members are private.

Instantiated exactly once by `PageEditor.init(true)`. Owns `pageView: PageView`, `skipNextReloadConfirmation: boolean`, `content`, plus 20 private listener-handle fields.

---

## Lifecycle — Construction

Steps at `LiveEditPage.ts:119-129`:

1. Install `skipConfirmationListener` latching `skipNextReloadConfirmation` from `SkipLiveEditReloadConfirmationEvent`.
2. Bind `init` and subscribe to `InitializeLiveEditEvent`.

No view tree, no DOM work at construction.

---

## Lifecycle — Initialization (InitializeLiveEditEvent)

**Pre-try-catch rehydration** (steps 1–10 run BEFORE the try block; if any throw, `init` dies without firing `LiveEditPageInitializationErrorEvent`):

1. Capture `startTime = Date.now()` (`LiveEditPage.ts:132`).
2. `this.content = event.getContent()` (`:137`).
3. `UriHelper.setDomain(event.getHostDomain())` (`:140`).
4. `CONFIG.setConfig(event.getConfig())` (`:142`).
5. `Messages.addMessages(JSON.parse(CONFIG.getString('phrasesAsJson')))` (`:143`).
6. `AuthContext.init(Principal.fromJson(userJson), principalsJson.map(Principal.fromJson))` (`:144`).
7. `ProjectContext.get().setProject(Project.fromJson(event.getProjectJson()))` (`:146`).
8. `PageState.setState(event.getPageJson() ? PageBuilder().fromJson(...).build() : null)` (`:147`) — **this is the fragment-mode vs page-mode switch** (payload presence).
9. `ContentContext.get().setContent(event.getContent())` (`:149`).
10. `const body = Body.get().loadExistingChildren()` (`:152`).

**Inside try-catch** (`LiveEditPage.ts:153-171`):

11. Build `this.pageView` via `PageViewBuilder()` (`LiveEditPage.ts:154-158`).
12. On throw: fire `LiveEditPageInitializationErrorEvent(message)` with typed `Exception.getMessage()` or raw error stringified; return early. No DnD init, no listeners, no ready event.

**Post-build**:

13. `DragAndDrop.init(this.pageView)` (`:173`).
14. `Tooltip.allowMultipleInstances(false)` (`:175`).
15. `registerGlobalListeners()` — wires 18 handlers (`:177`).
16. `restoreSelection(contentId)` — reads `sessionStorage` under key `contentstudio:liveedit:selectedPath:<contentId>`, resolves path, calls `selectWithoutMenu()` + `scrollComponentIntoView()` if a view is found (`:179`).
17. `new LiveEditPageViewReadyEvent().fire()` (`:185`).

---

## Lifecycle — Teardown

- Window unload handler (`LiveEditPage.ts:216-223`) calls `this.pageView.remove()` unconditionally. The `skipNextReloadConfirmation` flag resets in the else branch but currently gates nothing observable (empty body in the false branch).
- `destroy(win)` removes bootstrap listeners via `win` and delegates to `unregisterGlobalListeners` (`:203-213, 491-528`). Asymmetry: `ComponentLoadedEvent.on(...)` is registered at `:238` but never unregistered (subscription leak).

---

## The 18 Global Listeners

Registered via `registerGlobalListeners()` at `LiveEditPage.ts:215-481`.

| Event | Handler behavior | Site |
|-------|-----------------|------|
| `WindowDOM.onUnload` | If `skipNextReloadConfirmation` truthy, reset flag; ALWAYS `pageView.remove()`. Flag has no observable effect today. | `:216-223` |
| `ComponentLoadedEvent(path)` | Resolve view; if layout, `createSortableLayout(view)`; else `refreshSortable()`. | `:227-238` |
| `ComponentViewDragStartedEvent` | Hide Highlighter, SelectedHighlighter, Shader, Cursor. | `:240-250` |
| `ComponentViewDragStoppedEvent` | Reset cursor; if locked, shade over pageView. | `:252-261` |
| `SelectComponentViewEvent(path, silent)` | If path set and view not already selected, `select(null, NONE, isSilent)` + `scrollComponentIntoView`. | `:263-277` |
| `DeselectComponentViewEvent(path?)` | With path: **BUG at `:285`** — inverted guard `!itemView.isSelected()` means already-selected views are NOT deselected. Without path: `pageView.getSelectedView()?.deselect(true)`. | `:279-293` |
| `SetComponentStateEvent(path, processing)` | Text views only: show/hide loading spinner. Silent for non-text. | `:295-308` |
| `AddComponentViewEvent(path, type)` | Resolve parent via `path.getParentPath()`; build via `parentView.createView(ItemType.fromComponentType(type))`; insert at numeric `path.getPath()` index with `newlyCreated=true`. | `:310-321` |
| `RemoveComponentViewEvent(path)` | Deselect if selected, then `view.remove()`. | `:323-336` |
| `LoadComponentViewEvent(path, isExisting)` | **Deferred**: fires `new EditorEvent(EditorEvents.ComponentLoadRequest, {view, isExisting})`. Tree NOT mutated. Consumer must acknowledge with `ComponentLoaded` or `ComponentLoadFailed`. | `:338-352` |
| `DuplicateComponentViewEvent(newPath)` | Assumes source at `newPath.getPath() - 1` under same parent; `view.duplicate()` if ComponentView. | `:354-364` |
| `MoveComponentViewEvent(from, to)` | `itemToMove.moveToRegion(regionViewTo, to.getPath())` when types match. | `:366-378` |
| `IframeBeforeContentSavedEvent` | Persist selection to sessionStorage: remove existing selected-path + text-cursor entries, then if selection is ComponentView or RegionView write its path. | `:382-400` |
| `SetPageLockStateEvent(toLock)` | `pageView.setLocked(isToLock())`. | `:402-406` |
| `SetModifyAllowedEvent(allowed)` | `pageView.setModifyPermissions(isModifyAllowed())`. | `:408-412` |
| `CreateOrDestroyDraggableEvent(type, create)` | **Proxy trick** — see below. | `:414-433` |
| `SetDraggableVisibleEvent(type, visible)` | Look up helper by id/attr; toggle visibility via draggable's `helper` fn. | `:435-448` |
| `ResetComponentViewEvent(path)` | `view.reset()` if ComponentView. | `:450-459` |
| `PageStateEvent(pageJson)` | Rebuild Page from JSON; `setState(null)` when absent. | `:461-465` |
| `UpdateTextComponentViewEvent(path, text, origin)` | **Loopback guard**: `origin === 'live'` → early return. Else `view.setText(text)` if TextComponentView. | `:467-480` |

### Handler categories

- **Auto-select + auto-scroll**: `SelectComponentViewEvent`, init-time `restoreSelection`.
- **Silent (presentation-only)**: drag started/stopped, SetComponentStateEvent, SetPageLockState, SetModifyAllowed, SetDraggableVisible.
- **Deferred to npm consumer**: `LoadComponentViewEvent` → `EditorEvents.ComponentLoadRequest`.
- **Tree-mutating**: Add, Remove, Duplicate, Move, Reset, UpdateText, PageState.
- **Persistence-only**: IframeBeforeContentSaved.

---

## The CreateOrDestroyDraggableEvent Proxy Trick

**Why**: the wizard UI triggers component inserts from outside the iframe (palette drag), but jQuery-UI Draggable requires a real, hit-tested DOM element inside the iframe to own the drag session. The hidden `<div>` is that required element; simulated mousedown/mouseup drive jQuery-UI through its start/stop state transitions without real user input.

**Create branch** (`LiveEditPage.ts:416-423`):
1. Append `<div id="drag-helper-<type>" data-portal-component-type="<type>">` to `<body>`.
2. `pageView.createDraggable(item)` — installs jQuery-UI draggable behavior.
3. `item.simulate('mousedown').hide()` — jQuery-UI believes the user has pressed the element; hide so only the drag helper chip shows.

**Destroy branch** (`LiveEditPage.ts:424-431`):
1. Look up by id + data-attr; abort silently if missing.
2. `item.simulate('mouseup')` — cleanly end the drag session.
3. `pageView.destroyDraggable(item)` → `item.remove()`.

**Template bug**: `LiveEditPage.ts:419` has extra `}` in the template string: `` `<div id="${idAttr}" ${dataAttr}}>` `` — a stray closing brace. Reimplementation should not reproduce this.

---

## Selection Persistence (sessionStorage)

- **Key**: `contentstudio:liveedit:selectedPath:<contentId>` (from `SessionStorageHelper`).
- **Write**: on `IframeBeforeContentSavedEvent`, first remove selected-path + text-cursor entries (`LiveEditPage.ts:383-384`), then if the current selection is a ComponentView or RegionView write `selected.getPath().toString()` (`LiveEditPage.ts:390-397`).
- **Read**: once during init via `restoreSelection(contentId)` (`LiveEditPage.ts:179, 188-196`). If the stored path resolves to a view, `selectWithoutMenu()` + `scrollComponentIntoView()`.
- **Contract**: wizard MUST fire `IframeBeforeContentSavedEvent` before triggering a reload; otherwise selection is lost.

---

## The Component Load Round-Trip

1. Wizard fires `LoadComponentViewEvent(path, isExisting)`.
2. `LiveEditPage` resolves the `ItemView`, emits local `EditorEvent(EditorEvents.ComponentLoadRequest, {view, isExisting})` — does NOT mutate the tree.
3. npm consumer (e.g. `EditorEventHandler.loadComponentView`) fetches fresh HTML (honoring `X-Has-Contributions` header to decide full page reload), sanitizes via DOMPurify for fragments, wraps and replaces the view, then calls `PageEditor.notify(ComponentLoaded, {path})` or `PageEditor.notify(ComponentLoadFailed, {path, reason})`.
4. `ComponentLoaded` → `ComponentLoadedEvent` on the iframe bus → `LiveEditPage.ts:227-238` triggers sortable refresh (`createSortableLayout` for layouts, `refreshSortable()` otherwise).

Without the acknowledgement, freshly re-mounted regions will not accept drops.

---

## Register / Unregister Symmetry

All listener handles are paired in `registerGlobalListeners` / `unregisterGlobalListeners` EXCEPT:

- **`ComponentLoadedEvent.on(this.componentLoadedListener)` at `:238` — MISSING `.un` in `unregisterGlobalListeners`.** Subscription leak; `destroy` leaves a closure holding `pageView`.
- **`SetDraggableVisibleEvent.on` at `:448` — MISSING `.un`.** Same leak pattern.
- `disableLinks` jQuery handlers installed on the page body are never removed.

---

## Error Surfaces

- `PageViewBuilder.build()` throw inside `init` is caught → fires `LiveEditPageInitializationErrorEvent` and returns early (`LiveEditPage.ts:153-171`).
- Pre-try-catch rehydration (`:137-152`): any JSON-parse or `fromJson` failure throws unhandled — the wizard never sees an init-error event.
- Silent swallows: `getItemViewByPath` returns undefined for null path; most handlers early-return on lookup failure; `UpdateTextComponentViewEvent` silently drops `origin === 'live'` echoes.
- Re-init unsafe: no guard; double subscription if `InitializeLiveEditEvent` fires twice.
- `Messages.addMessages` accumulates on re-init.
- Dead helper `getComponentErrorText` at `:530-536` has no call sites.

---

## Contract Invariants for Reimplementation

1. Single-shot init; wizard must wait for `LiveEditPageViewReadyEvent` before publishing routed events.
2. If `LiveEditPageInitializationErrorEvent` fires, recreate the iframe — no retry path exists.
3. `params.contentId` must be present in the init payload (load-bearing for sessionStorage).
4. `InitializeLiveEditEvent` payload: `{hostDomain, config (with phrasesAsJson), userJson, principalsJson, projectJson, pageJson?, params: {contentId}, content}`.
5. Palette-drag precondition: wizard must fire `CreateOrDestroyDraggableEvent(type, true)` before palette drops.
6. Load-request requires round-trip: wizard → `LoadComponentViewEvent` → consumer fetches + re-mounts → `notify(ComponentLoaded | ComponentLoadFailed)`.
7. `UpdateTextComponentViewEvent(origin='live')` is a self-echo; must be dropped. If wizard mislabels origin, the loopback guard breaks.
8. `CreateOrDestroyDraggableEvent` destroy must proceed in order: `simulate('mouseup')` → `destroyDraggable(item)` → `item.remove()`.

---

## Non-Goals

- Does not own HTTP fetching (delegated to consumer via `ComponentLoadRequest`).
- Does not own HTML sanitization (consumer handles).
- Does not own drag mechanics (delegated to `DragAndDrop`).
- Does not participate in the `ComponentLoadFailed` channel on success paths.
- Does not guard against double-init.
- Does not show or suppress reload-confirmation dialogs.
- Does not clean up singleton overlays on destroy.

---

## Suspicious Conditions

- **`LiveEditPage.ts:285` inverted guard**: `if (itemView && !itemView.isSelected()) { itemView.deselect(true); }` — deselects only views that were NOT already selected. Path-based `DeselectComponentViewEvent` is effectively a no-op for the actually-selected item.
- **`LiveEditPage.ts:217-223` skip-confirmation flag is dead code**: both branches converge on `pageView.remove()`; the flag only self-clears.
- **`LiveEditPage.ts:419` template bug**: extra `}` in draggable helper HTML.
- **Pre-try-catch rehydration** (`LiveEditPage.ts:137-152`): any JSON-parse or `fromJson` failure throws unhandled out of the handler — no init-error event fired.
- **Re-init unsafe**: no guard; double subscription if `InitializeLiveEditEvent` fires twice.
- **`destroy(win)` forwards `win` only to bootstrap unsubscribes**; global listeners ignore `win`.
- **Duplicate-from-preceding-sibling assumption** in `DuplicateComponentViewEvent` handler (`LiveEditPage.ts:356`): if the wizard inserts the duplicate above the source, the wrong view fires.
- **`ComponentLoadedEvent` and `SetDraggableVisibleEvent` subscriptions never unregistered** — leak on destroy.
