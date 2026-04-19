# Architecture

> This document covers the high-level runtime topology, initialization lifecycle, parse-and-registry flow, and module inventory for the legacy in-iframe page editor. It is derived from the scout analysis of 43 TypeScript files (6048 LOC) under `.worktrees/master/src/main/resources/assets/js/`.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Runtime Model](#runtime-model)
3. [Tech-Stack Signals](#tech-stack-signals)
4. [Entry Points](#entry-points)
5. [Iframe / Wizard Boundary](#iframe--wizard-boundary)
6. [Parse and Registry Flow](#parse-and-registry-flow)
7. [Module Inventory](#module-inventory)
8. [Critical Modules](#critical-modules)
9. [Cross-Module Signals](#cross-module-signals)

---

## Purpose

The bundle is a **live page editor runtime injected into a CMS preview iframe**. It wraps server-rendered HTML with an editor layer that detects `data-portal-*` attributes on existing markup, builds an in-memory view tree (`PageView` → `RegionView` → `ComponentView` with specializations for `part`, `layout`, `text`, `fragment`), and overlays editor chrome (hover outline, selection crosshair, darkening shader, drag placeholder, context menu) on top of the original page without replacing it.

User-visible verbs inside the iframe: hover to highlight, click to select, right-click / long-touch to open context menu, keyboard `Del`/`Backspace` to remove the selected component, drag between regions or from the parent's palette into a region, duplicate, reset to default, detach a fragment, inline-edit text, lock/unlock the whole page.

Source of truth: `index.ts:1-27` for the published surface; `PageEditor.ts:254-333` for bootstrap; `LiveEditPage.ts:131-186` for initialization; `ItemView.ts:126-1120` for the behavioral core.

---

## Runtime Model

- **Client-side browser runtime inside a preview iframe.** Single-threaded, event-driven. No server communication from the iframe itself.
- **Communication boundary is bidirectional across the iframe.** Outgoing: iframe constructs event class instances (e.g. `SelectComponentEvent`, `MoveComponentEvent`, `PageLockedEvent`) and calls `.fire()`; the `IframeEventBus` (from `@enonic/lib-admin-ui`) serializes them to the parent. Incoming: wizard fires corresponding `...ViewEvent` instances (e.g. `SelectComponentViewEvent`, `AddComponentViewEvent`); the iframe subscribes via each class's static `.on()` method in `LiveEditPage.registerGlobalListeners` (`LiveEditPage.ts:215-481`). The registered class list lives in `PageEditor.initializeEventBus` (`PageEditor.ts:199-243`).
- **Drag-and-drop is jQuery-UI `sortable` + `draggable`** (`DragAndDrop.ts:1-3`; sortable init `DragAndDrop.ts:119-151`). jQuery is imported globally for event simulation (`PageEditor.ts:1-4`, `LiveEditPage.ts:419-430`).
- **Editor chrome singletons** (`Highlighter`, `SelectedHighlighter`, `Shader`, `Cursor`, `DragPlaceholder`) are appended to `Body.get()` and positioned with absolute coordinates over the page (`Highlighter.ts:41`, `Shader.ts:41-42`).
- **All state is process-local to the iframe window.** `ItemViewIdProducer` assigns monotonically increasing numeric IDs per page load (`ItemViewIdProducer.ts:1-11`); the mapping of `ItemViewId → ItemView` is held in `PageView.viewsById` (`PageView.ts:85, 528-542`). Selection is restored from `sessionStorage` via `SessionStorageHelper` (`LiveEditPage.ts:188-197`).

---

## Tech-Stack Signals

- `PageEditor.ts:2-4` imports `jquery`, `jquery-ui/dist/jquery-ui.js`, `jquery-simulate/jquery.simulate.js` — DOM manipulation and drag emulation.
- `DragAndDrop.ts:1-3` imports `jquery-ui/ui/widgets/sortable`, `.../draggable`, `.../droppable` — drag/drop backbone.
- `ItemView` extends `Element` from `@enonic/lib-admin-ui/dom/Element` (`ItemView.ts:1, 126-128`) — views are DOM-wrapper objects from an in-house widget library.
- `PageEditor.ts:199-243` uses `IframeEventBus.get().registerClass(...) / .addReceiver(parent)` to register 30+ event class constructors that can cross the iframe.
- `LiveEditPage.ts:56-60` imports from `@enonic/lib-contentstudio/app/page/*`, `.../wizard/page/PageState`, `.../project/ProjectContext` — the iframe rehydrates context (project, page state, auth principal) received via `InitializeLiveEditEvent`.
- No modern framework runtime. Plain TypeScript classes extending `Element`.
- Output exposed as an npm package: `index.ts:1-27` re-exports the public surface.

---

## Entry Points

| Entry | Description |
|-------|-------------|
| `index.ts:1-27` | Public npm export surface. |
| `PageEditor.ts:262-275` | `PageEditor.init(editMode)` — bootstraps the editor. |
| `LiveEditPage.ts:119-129` | `LiveEditPage` constructor — bootstrap listeners only. |
| `LiveEditPage.ts:131-186` | `LiveEditPage.init(event)` — full initialization triggered by wizard. |
| `PageEditor.ts:293-317` | `PageEditor.notify(...)` — npm outbound channel. |
| `PageEditor.ts:285-291` | `PageEditor.on/un(eventName, handler)` — npm inbound channel. |

---

## Iframe / Wizard Boundary

The iframe and the parent wizard window are different JavaScript realms. Class instances cannot be passed by reference. The `IframeEventBus` serializes event instances by class name + payload across the boundary. For serialization to work, both peers must have registered each class via `registerClass('Name', Ctor)`. The list of registered classes is in `PageEditor.ts:199-243`.

**Outgoing** (iframe → wizard): the iframe fires event class instances; `IframeEventBus` serializes and delivers to `window.parent`.

**Incoming** (wizard → iframe): wizard fires corresponding events; iframe subscribes via static `.on()` in `LiveEditPage.registerGlobalListeners`.

**npm-level channel** (iframe ↔ npm host): a separate lightweight channel using `Event.bind/unbind` for the 4 `EditorEvents` (`ComponentLoadRequest`, `ComponentLoaded`, `ComponentLoadFailed`, `PageReloadRequest`). This channel is for communication between the editor library and its npm consumer (not the wizard directly).

The full event catalog is in [`contracts.md`](contracts.md).

---

## Parse and Registry Flow

The parse that builds the editable view tree runs once per `InitializeLiveEditEvent`. The order is:

1. Wizard publishes `InitializeLiveEditEvent`.
2. `LiveEditPage.init` allocates one `ItemViewIdProducer` + one `DefaultItemViewFactory` (`LiveEditPage.ts:155-156`).
3. `PageViewBuilder.build()` runs `parseItemViews()` clearing `viewsById`, then:
   - **Page mode**: `doParseItemViews` registers each `RegionItemType` descendant as a `RegionView`; each `RegionView` constructor runs `parseComponentViews` building `ComponentView`s via factory; `LayoutComponentView` recurses into its own regions.
   - **Fragment mode** (`liveEditParams.isFragment === true`): `doParseFragmentItemViews` builds the single top-level component; a top-level `LayoutComponentView`'s regions populate `regionViews`.
4. Each constructed view's `ItemViewId → view` goes into `viewsById` via `registerItemView` (called for each view in `toItemViewArray()` during parse).
5. `PageView.itemViewAddedListener` (`PageView.ts:179-201`) is wired to each `RegionView` so subsequent add/remove operations bubble into the registry.
6. `DragAndDrop.init(pageView)` creates the singleton and calls `createSortable` on every region.
7. `registerGlobalListeners()` subscribes the 18+ inbound event handlers.
8. `restoreSelection(contentId)` reads the stored path, resolves it, calls `selectWithoutMenu` + `scrollComponentIntoView`.
9. `LiveEditPageViewReadyEvent` fires — wizard must not publish view-routed events before this.

**Three parse loops** exist in the codebase — one per level of nesting:
- `PageView.doParseItemViews` (`PageView.ts:573-592`)
- `RegionView.doParseComponentViews` (`RegionView.ts:445-475`)
- `LayoutComponentView.doParseRegions` (`LayoutComponentView.ts:93-116`)

`ItemType.fromElement` is the parse discriminator at each loop: it reads `data-portal-*` attributes from DOM elements to classify them.

---

## Module Inventory

| Module | Path(s) | Files | LOC | Role |
|--------|---------|-------|-----|------|
| Bootstrap & lifecycle | `page-editor/PageEditor.ts`, `index.ts` | 2 | 359 | Static entry point. Installs jQuery globals, registers ~30 event classes on the iframe bus, attaches global listeners, instantiates `LiveEditPage`, exposes npm `on/un/notify`. |
| Iframe event router | `page-editor/LiveEditPage.ts` | 1 | 537 | Listens to 18+ incoming events and dispatches view-tree mutations; rehydrates context from `InitializeLiveEditEvent`; restores selection from sessionStorage. |
| npm event surface | `page-editor/event/EditorEvent.ts` | 1 | 28 | Declares `EditorEvents` constants + `EditorEvent<D>` wrapper (sole local event type). |
| View hierarchy base | `page-editor/ItemView.ts`, `ItemViewPlaceholder.ts`, `ItemViewContextMenuPosition.ts`, `CreateItemViewConfig.ts`, `CreateTextComponentViewConfig.ts` | 5 | 1241 | Abstract base for every selectable view; hover/select/context-menu/touch/keyboard/insert-submenu/placeholder logic. |
| IDs & factory | `page-editor/ItemViewId.ts`, `ItemViewIdProducer.ts`, `ItemViewFactory.ts` | 3 | 147 | Numeric per-page IDs + pluggable `ItemViewFactory.createView(type, config)`. |
| Page root view | `page-editor/PageView.ts`, `PagePlaceholder.ts`, `PagePlaceholderInfoBlock.ts` | 3 | 801 | Parses body, holds `viewsById` registry, page-lock state machine, page-level context menu, dual page/fragment modes. |
| Region view | `page-editor/RegionView.ts`, `RegionPlaceholder.ts`, `RegionViewContextMenuTitle.ts` | 3 | 502 | `data-portal-region` container; ordered components; emits add/remove bubble-up; drag-over class. |
| Component view base | `page-editor/ComponentView.ts`, `ComponentItemType.ts`, `ComponentViewContextMenuTitle.ts`, `ContentBasedComponentView.ts`, `DescriptorBasedComponentView.ts`, `DescriptorBasedComponentViewPlaceholder.ts` | 6 | 584 | Base for region children; Remove/Duplicate/Reset/Inspect/CreateFragment actions; replaceWith/moveToRegion. |
| Part component | `page-editor/part/*.ts` | 3 | 76 | `[data-portal-component-type=part]` specialization; empty-placeholder message. |
| Layout component | `page-editor/layout/*.ts` | 3 | 184 | Hosts child `RegionView`s; parses regions; triggers sortable re-init after load. |
| Text component | `page-editor/text/*.ts` | 3 | 244 | Inline text edit via double-click; accepts text updates from wizard; RTL + image URL rewrite. |
| Fragment component | `page-editor/fragment/*.ts` | 3 | 157 | Embedded fragment; strips inner component-type attributes; adds "Detach fragment" action. |
| Drag & drop | `page-editor/DragAndDrop.ts`, `DragPlaceholder.ts` | 2 | 732 | Singleton wrapping jQuery-UI sortable/draggable; drop rules; emits Add/MoveComponent + drag lifecycle events. |
| Overlay chrome | `page-editor/Highlighter.ts`, `SelectedHighlighter.ts`, `Shader.ts`, `Cursor.ts` | 4 | 448 | SVG overlay singletons: hover outline, selection crosshair, darkening shader, cursor swap. |

---

## Critical Modules

The following modules were nominated for deep analysis due to breadth of behavior or cross-cutting impact. Deep specs (merging medium-depth + deep-dive content) are available in `modules/`:

1. **`LiveEditPage` — `LiveEditPage.ts` (537 LOC)** ([`modules/inbound-router.md`](modules/inbound-router.md)) — 18-event inbound router; context rehydration; draggable proxy; selection persistence. Every inbound wizard event passes through this file.

2. **`ItemView` — `ItemView.ts` (1120 LOC)** ([`modules/view-base.md`](modules/view-base.md)) — behavioral base; bubble-through hover; click decision tree; long-press touch; context menu lifecycle; insert submenu. Every editable view extends this.

3. **`DragAndDrop` — `DragAndDrop.ts` (638 LOC)** ([`modules/drag-and-drop.md`](modules/drag-and-drop.md)) — jQuery-UI sortable/draggable state machine; drop rules; Add/MoveComponent emission; Firefox workarounds.

Other important modules without separate deep-dives:
- `PageView.ts` (644 LOC) — tree registry; lock/unlock; page-level menu; fragment/page dual mode.
- `RegionView.ts` (480 LOC) — ordered component list; add/remove bubbling; parse loop.
- `ComponentView.ts` (433 LOC) — Del/Backspace bindings; replaceWith, moveToRegion, duplicate, inspect, create-fragment.
- `PageEditor.ts` (333 LOC) — entry, event-class registration, npm facade.

---

## Cross-Module Signals

### Named incoming events (wizard → iframe)

Registered in `PageEditor.initializeEventBus` (`PageEditor.ts:221-240`) and subscribed in `LiveEditPage.registerGlobalListeners` (`LiveEditPage.ts:215-481`).

| Event class | Handler | Effect |
|-------------|---------|--------|
| `InitializeLiveEditEvent` | `LiveEditPage.ts:128, 131-186` | Full rehydration: config, phrases, auth, project, page, content; build PageView; init DragAndDrop. |
| `SkipLiveEditReloadConfirmationEvent` | `:120-124` | Suppresses unload confirm once. |
| `SelectComponentViewEvent(path, silent)` | `:263-277` | Select view at path; scroll into view. |
| `DeselectComponentViewEvent(path?)` | `:279-293` | Deselect specific or current (see bug in contracts.md). |
| `AddComponentViewEvent(path, componentType)` | `:310-321` | Parent view creates child at index. |
| `RemoveComponentViewEvent(path)` | `:323-336` | Remove view at path (deselect first). |
| `MoveComponentViewEvent(from, to)` | `:366-378` | Move via `ComponentView.moveToRegion`. |
| `DuplicateComponentViewEvent(path)` | `:354-364` | Duplicate component. |
| `ResetComponentViewEvent(path)` | `:450-459` | Recreate view from scratch. |
| `LoadComponentViewEvent(path, isExisting)` | `:338-352` | Fires npm-level `ComponentLoadRequest` with `{view, isExisting}`. |
| `UpdateTextComponentViewEvent(path, text, origin)` | `:467-480` | Update text (ignored if origin is `'live'`). |
| `SetComponentStateEvent(path, processing)` | `:295-308` | Show/hide spinner on text component. |
| `SetPageLockStateEvent(toLock)` | `:402-406` | Lock/unlock page. |
| `SetModifyAllowedEvent(modifyAllowed)` | `:408-412` | Apply permission; false forces lock. |
| `CreateOrDestroyDraggableEvent(type, create)` | `:414-433` | Simulate mousedown/up on hidden element. |
| `SetDraggableVisibleEvent(type, visible)` | `:435-448` | Toggle drag helper element. |
| `PageStateEvent(pageJson)` | `:461-465` | Replace `PageState`. |
| `ComponentLoadedEvent(path)` | `:227-238` | Re-init sortable on new region / layout sub-regions. |
| `IframeBeforeContentSavedEvent` | `:382-400` | Persist selection path to sessionStorage. |

### Outgoing events (iframe → wizard)

| Emitter | Event | Meaning |
|---------|-------|---------|
| `ItemView.ts:361,838,848`; `PageView.ts:188` | `SelectComponentEvent` | View selected. |
| `ItemView.ts:889` | `DeselectComponentEvent` | Deselection. |
| `ItemView.ts:1083`; `DragAndDrop.ts:301` | `AddComponentEvent` | Insert / drop from palette. |
| `ComponentView.ts:192`; `PageView.ts:158` | `ResetComponentEvent` / `PageResetEvent` | Reset to default. |
| `ComponentView.ts:198,223` | `RemoveComponentRequest` | Delete / Del / Backspace. |
| `ComponentView.ts:204` | `DuplicateComponentEvent` | Duplicate. |
| `ComponentView.ts:214`; `FragmentComponentView.ts:62` | `CreateFragmentEvent` / `DetachFragmentEvent` | Promote / detach. |
| `ComponentView.ts:187`; `PageView.ts:151,272,336` | `ComponentInspectedEvent` | Open inspector. |
| `ContentBasedComponentView.ts:27` | `EditContentFromComponentViewEvent` | Open fragment content. |
| `TextComponentView.ts:61,159` | `EditTextComponentViewEvent` | Enter inline text edit. |
| `PagePlaceholder.ts:52` | `SelectPageDescriptorEvent` | User picked page controller. |
| `DragAndDrop.ts:306` | `MoveComponentEvent` | Drag-move completed. |
| `DragAndDrop.ts:488,512,531,553` | `ComponentViewDragStarted/Stopped/Dropped/CanceledEvent` | Drag lifecycle. |
| `PageView.ts:331,335,169` | `PageLockedEvent`, `PageUnlockedEvent`, `SaveAsTemplateEvent` | Page state broadcasts. |
| `PageEditor.ts:151` | `IframeEvent('editor-iframe-loaded')` | Iframe load. |
| `PageEditor.ts:131-144` | `IframeEvent('editor-modifier-pressed')` | Global key bubble. |
| `PageEditor.ts:167` | `ContentPreviewPathChangedEvent` | Internal link click. |
| `LiveEditPage.ts:185` | `LiveEditPageViewReadyEvent` | Page tree built. |
| `LiveEditPage.ts:164,167` | `LiveEditPageInitializationErrorEvent` | Init failure. |

### Shared singletons / global state

- `Highlighter.INSTANCE`, `SelectedHighlighter.SELECT_INSTANCE`, `Shader.INSTANCE`, `Cursor.INSTANCE`, `DragPlaceholder.instance`, `DragAndDrop.instance` — all appended to `Body.get()`, absolute-positioned overlays.
- `PageViewController.get()` (from `lib-contentstudio`) — flag store: `isHighlightingDisabled`, `isContextMenuDisabled`, `isNextClickDisabled`, `isLocked`, `isTextEditModeChanged`. Referenced `ItemView.ts:395-419,652-655,739`; `RegionView.ts:169-175`.
- `PageState` — deserialized page model; refreshed by `PageStateEvent` (`LiveEditPage.ts:461-465`); read by `DescriptorBasedComponentView.getComponent()`.
- `Store.parentInstance()` — iframe reads parent's active key bindings to forward matching shortcuts (`PageEditor.ts:114-124`).
- `SessionStorageHelper` — persists selection path and text-cursor position keyed by `contentId`.

### DOM contract

The editor depends on server-rendered HTML carrying specific attributes:

| Attribute | Written by | Read by |
|-----------|-----------|---------|
| `data-portal-region` | Server | Every parse loop; `DragAndDrop.REGION_SELECTOR`; `RegionView.isElementOverRegion` |
| `data-portal-component-type` (`part\|layout\|text\|fragment`) | Server | `ItemType.fromElement`; stripped by `FragmentComponentView.doParseFragmentComponents` |
| `data-portal-region-name` | Server | `RegionView.getRegionName`; stripped inside fragments |
| `data-portal-placeholder-error` | Server on render failure | `ItemView.isPlaceholderNeeded`; hoisted by `FragmentComponentView.removeComponentTypeAttrs` |
| `data-content-path` | Server on `<a>` | `PageEditor.ts:176` for in-XP link navigation |
| `data-live-edit-id` | Editor (`ItemView.setItemId`) | `ItemView.parseItemId`; `PageView.viewsById` |
| `data-live-edit-selected="true"` | Editor (`ItemView.selectItem`) | Removed by `deselect`; enforces exactly-one-selected invariant |
