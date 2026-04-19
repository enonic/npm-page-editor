# Cross-Module Contracts

> This is the authoritative reference for all cross-module and cross-boundary communication in the legacy in-iframe page editor. It covers inbound and outbound events (with exact payload shapes), the npm-level API, shared singletons, DOM attribute contract, parse/registry build order, invariants, and known asymmetries/bugs.

---

## Table of Contents

1. [Incoming Events (wizard → iframe)](#incoming-events-wizard--iframe)
2. [Outgoing Events (iframe → wizard)](#outgoing-events-iframe--wizard)
3. [npm-Level Event Contract (consumer ↔ editor)](#npm-level-event-contract-consumer--editor)
4. [Public Export Map](#public-export-map)
5. [Shared Singletons and Global State](#shared-singletons-and-global-state)
6. [Shared DOM Contract](#shared-dom-contract)
7. [Parse and Registry Build Order](#parse-and-registry-build-order)
8. [Contract Invariants](#contract-invariants)
9. [Contract Asymmetries and Known Bugs](#contract-asymmetries-and-known-bugs)
10. [Subsystem Clusters](#subsystem-clusters)
11. [Key Files for Reimplementation](#key-files-for-reimplementation)

---

## Incoming Events (wizard → iframe)

Every event below is registered on the iframe bus in `bootstrap-and-surface/PageEditor.ts:199-243` and subscribed in `inbound-router/LiveEditPage.ts:215-481`. Payload shapes are inferred from getter call sites cited.

| Event | Classification | Fire site | Listen site | Payload (from getter call sites) |
|-------|---------------|-----------|-------------|----------------------------------|
| `InitializeLiveEditEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:128, 131-186` | `{ hostDomain: string, config: ConfigRecord, userJson, principalsJson, projectJson, pageJson?, params: { contentId: string }, content: ContentSummaryAndCompareStatus }` — getters: `getHostDomain()`, `getConfig()`, `getUserJson()`, `getPrincipalsJson()`, `getProjectJson()`, `getPageJson()`, `getParams()`, `getContent()` (`LiveEditPage.ts:137-149`) |
| `SkipLiveEditReloadConfirmationEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:120-124` | `{ isSkip: boolean }` — getter `isSkip()` (`LiveEditPage.ts:121`) |
| `SelectComponentViewEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:263-277` | `{ getPath(): string, isSilent(): boolean }` |
| `DeselectComponentViewEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:279-293` | `{ getPath(): string | null }` |
| `AddComponentViewEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:310-321` | `{ getComponentPath(): ComponentPath, getComponentType(): { getShortName(): string } }` |
| `RemoveComponentViewEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:323-336` | `{ getComponentPath(): ComponentPath }` |
| `MoveComponentViewEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:366-378` | `{ getFrom(): ComponentPath, getTo(): ComponentPath }` |
| `DuplicateComponentViewEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:354-364` | `{ getComponentPath(): ComponentPath }` (destination path; source is `destIndex - 1` under same parent) |
| `ResetComponentViewEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:450-459` | `{ getComponentPath(): ComponentPath }` |
| `LoadComponentViewEvent` | bidirectional-rebroadcast | external (wizard) | `inbound-router/LiveEditPage.ts:338-352` | `{ getComponentPath(): ComponentPath, isExisting(): boolean }` — rebroadcast as npm `EditorEvent(ComponentLoadRequest, {view, isExisting})` (`:346-349`) |
| `UpdateTextComponentViewEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:467-480` | `{ getPath(): string, getText(): string, getOrigin(): 'live' | other }` — `'live'` origin is dropped (loopback guard, `:470`) |
| `SetComponentStateEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:295-308` | `{ getPath(): string, isProcessing(): boolean }` |
| `SetPageLockStateEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:402-406` | `{ isToLock(): boolean }` |
| `SetModifyAllowedEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:408-412` | `{ isModifyAllowed(): boolean }` — **NOTE: missing from `PageEditor.initializeEventBus` registration** (see Asymmetries) |
| `CreateOrDestroyDraggableEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:414-433` | `{ getType(): string, isCreate(): boolean }` |
| `SetDraggableVisibleEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:435-448` | `{ getType(): string, isVisible(): boolean }` |
| `PageStateEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:461-465` | `{ getPageJson(): PageJson | null }` |
| `ComponentLoadedEvent` | bidirectional-within-bundle | `bootstrap-and-surface/PageEditor.ts:306` (via `PageEditor.notify(ComponentLoaded, {path})`) + external wizard | `inbound-router/LiveEditPage.ts:227-238` | `{ getComponentPath(): ComponentPath }` — triggers `createSortableLayout` (if layout) or `refreshSortable()` otherwise |
| `IframeBeforeContentSavedEvent` | inbound | external (wizard) | `inbound-router/LiveEditPage.ts:382-400` | no payload consumed; side-effect = persist selection path + text-cursor pos to sessionStorage |
| `ComponentViewDragStartedEvent` | bidirectional-within-bundle | `drag-and-drop/DragAndDrop.ts:488` | `inbound-router/LiveEditPage.ts:240-250` (hides overlays) + external wizard consumer | `ComponentPath | undefined` (undefined for palette-originated drags) |
| `ComponentViewDragStoppedEvent` | bidirectional-within-bundle | `drag-and-drop/DragAndDrop.ts:512` | `inbound-router/LiveEditPage.ts:252-261` (resets cursor; re-shades if locked) + external wizard consumer | `ComponentPath | undefined` |

---

## Outgoing Events (iframe → wizard)

| Event | Classification | Fire site(s) | Listen site | Payload |
|-------|---------------|-------------|-------------|---------|
| `SelectComponentEvent` | outbound | `view-base/ItemView.ts:361` (touch), `:682-687` (click), `:838`, `:848`; `page-view/PageView.ts:188` (auto-created text) | external (wizard) | Click: `{ path, position: ClickPosition, newlyCreated?: boolean, rightClicked: boolean }`; touch: `{ path, position: touchPoint | null }`; auto-created text: `{ path, position: null, rightClicked: true }` (see Asymmetries) |
| `DeselectComponentEvent` | outbound | `view-base/ItemView.ts:889` | external (wizard) | `(path: ComponentPath)` |
| `AddComponentEvent` | outbound | `view-base/ItemView.ts:1083` (Insert submenu); `drag-and-drop/DragAndDrop.ts:301` (palette drop) | external (wizard) | `(path: ComponentPath, componentType: ComponentType)` |
| `MoveComponentEvent` | outbound | `drag-and-drop/DragAndDrop.ts:306` | external (wizard) | `(from: ComponentPath, to: ComponentPath)` — self-move NOT suppressed |
| `RemoveComponentRequest` | outbound | `component-view-base/ComponentView.ts:198` (menu Remove), `:223` (Del/Backspace) | external (wizard) | `(path: ComponentPath)` |
| `DuplicateComponentEvent` | outbound | `component-view-base/ComponentView.ts:204` | external (wizard) | `(path: ComponentPath)` |
| `ResetComponentEvent` | outbound | `component-view-base/ComponentView.ts:192` | external (wizard) | `(path: ComponentPath)` |
| `CreateFragmentEvent` | outbound | `component-view-base/ComponentView.ts:214` | external (wizard) | `(path: ComponentPath)` |
| `DetachFragmentEvent` | outbound | `specialized-component-views/fragment/FragmentComponentView.ts:62` | external (wizard) | `(path: ComponentPath)` |
| `ComponentInspectedEvent` | outbound | `component-view-base/ComponentView.ts:187`; `page-view/PageView.ts:151,272,336` | external (wizard) | `(path: ComponentPath)` — root path for PageView |
| `EditContentFromComponentViewEvent` | outbound | `component-view-base/ContentBasedComponentView.ts:27` | external (wizard) | `(contentId: ContentId)` via `liveEditParams.getFragmentIdByPath(path)` |
| `EditTextComponentViewEvent` | outbound | `specialized-component-views/text/TextComponentView.ts:61,159` | external (wizard) | `(path: ComponentPath)` |
| `SelectPageDescriptorEvent` | outbound | `page-view/PagePlaceholder.ts:52` | external (wizard) | `(descriptorKeyString: string)` |
| `ComponentViewDragDroppedEvent` | outbound | `drag-and-drop/DragAndDrop.ts:531` | external (wizard) | `(from: ComponentPath | null, to: ComponentPath)` — `from=null` for palette drops |
| `ComponentViewDragCanceledEvent` | outbound | `drag-and-drop/DragAndDrop.ts:553` | external (wizard) | `(componentView: ComponentView)` — full view, NOT a path; inconsistent shape |
| `PageLockedEvent` | outbound | `page-view/PageView.ts:331` | external (wizard) | `()` |
| `PageUnlockedEvent` | outbound | `page-view/PageView.ts:335` | external (wizard) | `()` |
| `SaveAsTemplateEvent` | outbound | `page-view/PageView.ts:169` | external (wizard) | `()` |
| `PageResetEvent` | outbound | `page-view/PageView.ts:158` | external (wizard) | `()` |
| `LiveEditPageViewReadyEvent` | outbound | `inbound-router/LiveEditPage.ts:185` | external (wizard) | `()` — fired once after initial PageView build + selection restore |
| `LiveEditPageInitializationErrorEvent` | outbound | `inbound-router/LiveEditPage.ts:164,167` | external (wizard) | `(message: string)` |
| `IframeEvent('editor-iframe-loaded')` | outbound | `bootstrap-and-surface/PageEditor.ts:151` | external (wizard) | no data |
| `IframeEvent('editor-modifier-pressed')` | outbound | `bootstrap-and-surface/PageEditor.ts:131-144` | external (wizard) | `{ type: string, config: { bubbles, cancelable, ctrlKey, altKey, shiftKey, metaKey, keyCode, charCode } }` |
| `ContentPreviewPathChangedEvent` | outbound | `bootstrap-and-surface/PageEditor.ts:167` | external (wizard) | `(path: string)` |
| `PageReloadRequestedEvent` | outbound | `bootstrap-and-surface/PageEditor.ts:299` (via `notify(PageReloadRequest)`) | external (wizard) | `()` |
| `LoadComponentFailedEvent` | outbound | `bootstrap-and-surface/PageEditor.ts:313` (via `notify(ComponentLoadFailed, {path, reason})`) | external (wizard) | `(path: ComponentPath, reason: Error)` |
| `MinimizeWizardPanelEvent` | outbound (registered only) | registered `PageEditor.ts:240`; no local fire site | external (wizard consumes) | — |

---

## npm-Level Event Contract (consumer ↔ editor)

Transport: `@enonic/lib-admin-ui` `Event.bind/unbind`. Four constants defined in `EditorEvents` (`event/EditorEvent.ts:3-8`).

| EditorEvents value | Direction | Produced by | Consumed by | Payload |
|-------------------|-----------|-------------|-------------|---------|
| `'component:load:request'` | editor → consumer | `LiveEditPage.ts:346-349` | host via `PageEditor.on(ComponentLoadRequest, handler)` | `EditorEvent<{ view: ItemView, isExisting: boolean }>` |
| `'component:loaded'` | consumer → editor | host via `PageEditor.notify(ComponentLoaded, {path})` (`PageEditor.ts:300-306`) | `ComponentLoadedEvent` on bus → `LiveEditPage.ts:227-238` | `{path: ComponentPath}` |
| `'component:load:failed'` | consumer → editor | host via `PageEditor.notify(ComponentLoadFailed, {path, reason})` (`PageEditor.ts:307-313`) | `LoadComponentFailedEvent` on bus → wizard | `{path: ComponentPath, reason: Error}` |
| `'page:reload:request'` | consumer ↔ editor | host via `PageEditor.notify(PageReloadRequest)` (`PageEditor.ts:298-299`) | `PageReloadRequestedEvent` on bus → wizard | no data |

### Component load round-trip

1. Wizard fires `LoadComponentViewEvent(path, isExisting)`.
2. `LiveEditPage` resolves `ItemView`, emits `EditorEvent(ComponentLoadRequest, {view, isExisting})` — does NOT mutate the tree.
3. npm consumer fetches fresh HTML, re-mounts it into the DOM, calls `PageEditor.notify(ComponentLoaded, {path})` or `PageEditor.notify(ComponentLoadFailed, {path, reason})`.
4. `ComponentLoaded` → `ComponentLoadedEvent` on the iframe bus → `LiveEditPage` refreshes jQuery-UI sortable (calls `createSortableLayout` for layouts, `refreshSortable()` otherwise).

Without the `ComponentLoaded` acknowledgement, freshly re-mounted regions will not accept drops.

---

## Public Export Map

All exports from `index.ts:1-27`:

`PageEditor`, `EditorEvents`, `EditorEvent`, `ItemView`, `ItemViewId`, `ItemViewIdProducer`, `CreateItemViewConfig`, `ItemViewFactory` (type), `DefaultItemViewFactory`, `ComponentItemType`, `ComponentView`, `DescriptorBasedComponentView`, `ContentBasedComponentView`, `PartComponentView`, `PartItemType`, `LayoutItemType`, `LayoutComponentView`, `TextItemType`, `TextComponentView`, `FragmentItemType`, `FragmentComponentView`, `RegionView`, `PageView`.

Re-exports: `Element`, `NewElementBuilder` (from `@enonic/lib-admin-ui`); `ComponentPath` (from `@enonic/lib-contentstudio`).

### Consumer contract

Evidence from `app-contentstudio`'s `EditorEventHandler.ts`: the host imports `PageEditor` + `EditorEvents`, calls `PageEditor.init(editMode)` once, binds `PageEditor.on(ComponentLoadRequest, handler)` to fetch and re-mount HTML, then acknowledges with `PageEditor.notify(ComponentLoaded | ComponentLoadFailed)`.

---

## Shared Singletons and Global State

| Identifier | Purpose | Writers | Readers |
|------------|---------|---------|---------|
| `Highlighter.INSTANCE` | Hover outline overlay | `view-base/ItemView.ts` highlight/unhighlight | `ItemView`, `RegionView`, `LiveEditPage` (hide on drag start) |
| `SelectedHighlighter.SELECT_INSTANCE` | Selection overlay + one-selected-view registry | `ItemView.selectItem/deselect` | `ItemView`, `LiveEditPage` |
| `Shader.INSTANCE` | Dim overlay (4-region + page) + click forwarding | `PageView.setLocked`, `ItemView` (shade calls commented out today) | `ItemView.handleShaderClick`, `LiveEditPage` (re-shade after drag stop) |
| `Cursor.INSTANCE` | Body cursor swapper | `ItemView.showCursor/resetCursor` | `ItemView`, `LiveEditPage` (reset on drag start/stop) |
| `DragPlaceholder.instance` | Drop placeholder in sortable slot | `DragAndDrop.handleSortStart`, `updateHelperAndPlaceholder` | `DragAndDrop` |
| `DragAndDrop.instance` | Drag state machine + sortable wiring | DragAndDrop handlers; `PageView.createDraggable/destroyDraggable`; `LayoutComponentView.createSortableLayout` | `ItemView:648` (isNewlyDropped click-suppression); `RegionView`; `LiveEditPage:227-238`; `LayoutComponentView` |
| `PageViewController` (external) | Global flags: highlightingDisabled, contextMenuDisabled, nextClickDisabled, locked, textEditModeChanged | `PageView.setLocked` (locked); `ItemView.handleClick` (setNextClickDisabled(false)) | `ItemView`, `RegionView` |
| `PageState` (external) | Deserialized page model | `LiveEditPage:147` (init), `:461-465` (PageStateEvent) | `DescriptorBasedComponentView.getComponent`; `TextComponentView.normalizeInitialValue` |
| `ContentContext` / `ProjectContext` / `AuthContext` | Current content/project/user | `LiveEditPage.init` | external consumers |
| `SessionStorageHelper` | Per-content selection + text-cursor persistence | `LiveEditPage:383-397` (IframeBeforeContentSavedEvent write) | `LiveEditPage:188-196` (init-time restoreSelection read) |
| `Store` (external) | Cross-iframe key/value; parent-side key bindings | `PageEditor:246` (publishes `$`) | `PageEditor:114-124` (parent KeyBindings) |
| `UriHelper` | URL manipulation + host-domain | `LiveEditPage:140` (setHostDomain) | `PageEditor:160-166` (window click listener) |
| `ItemViewIdProducer` (one instance) | Monotonic `ItemViewId` allocator (starts at 1, per-bootstrap) | PageView/RegionView/ComponentView constructors | same three modules |
| `PageView.viewsById` | Flat `ItemViewId → ItemView` registry | `PageView.registerItemView` on parse + via `itemViewAdded` bubbling | `PageView.getItemView*`; `LiveEditPage.getItemViewByPath` for every inbound view-targeted event |
| `IframeEventBus` | Serializes events across iframe boundary (receiver = `parent`) | every outbound event; `PageEditor.notify` | every inbound listener in `LiveEditPage` |

---

## Shared DOM Contract

The editor reads and writes DOM attributes as the primary state surface shared between server-rendered HTML and the editor runtime.

| Attribute | Written by | Read by | Notes |
|-----------|-----------|---------|-------|
| `data-portal-region` | Server | Every parse loop; `DragAndDrop.REGION_SELECTOR`; `RegionView.isElementOverRegion` | Presence marks an element as an editable region container |
| `data-portal-component-type` (`part\|layout\|text\|fragment`) | Server | `ItemType.fromElement`; stripped by `FragmentComponentView.doParseFragmentComponents` | Stripped inside fragments so inner nodes are invisible to drag-and-drop |
| `data-portal-region-name` | Server | `RegionView.getRegionName`; stripped inside fragments | Human-readable region name |
| `data-portal-placeholder-error` | Server on render failure | `ItemView.isPlaceholderNeeded`; hoisted to root by `FragmentComponentView.removeComponentTypeAttrs` | Disables `detachAction` and `editAction` on fragment |
| `data-content-path` | Server on `<a>` | `PageEditor.ts:176` | In-XP cross-page navigation detection |
| `data-live-edit-id` | Editor (`ItemView.setItemId`) | `ItemView.parseItemId`; `PageView.viewsById` | Per-page-load, not persisted across reload |
| `data-live-edit-selected="true"` | Editor (`ItemView.selectItem`) | Removed by `deselect`; enforces exactly-one-selected invariant | Sole DOM truth for selection state |

---

## Parse and Registry Build Order

1. Wizard publishes `InitializeLiveEditEvent`.
2. `LiveEditPage.init` allocates one `ItemViewIdProducer` + one `DefaultItemViewFactory` (`LiveEditPage.ts:155-156`).
3. `PageViewBuilder.build()` runs `parseItemViews()` clearing `viewsById`, then:
   - **Page mode**: `doParseItemViews` registers each `RegionItemType` descendant as `RegionView`; each `RegionView` constructor runs `parseComponentViews` building `ComponentView`s via factory; `LayoutComponentView` recurses into its own regions.
   - **Fragment mode** (`liveEditParams.isFragment === true`): `doParseFragmentItemViews` builds the single top-level component; a top-level `LayoutComponentView`'s regions populate `regionViews`.
4. Each constructed view's id → view goes into `viewsById` via `registerItemView` (called for each view in `toItemViewArray()` during parse).
5. `PageView.itemViewAddedListener` (`PageView.ts:179-201`) is wired to each `RegionView` so subsequent add/remove operations bubble into the registry.
6. `DragAndDrop.init(pageView)` creates singleton + `createSortable` on every region.
7. `registerGlobalListeners()` subscribes the 18+ inbound handlers.
8. `restoreSelection(contentId)` reads stored path, resolves, calls `selectWithoutMenu` + `scrollComponentIntoView`.
9. `LiveEditPageViewReadyEvent` fires — wizard must not publish view-routed events before this.

---

## Contract Invariants

- **Single-shot init**: `PageEditor.init` throws on re-init; exactly one `LiveEditPage`.
- **Ordering**: wizard must wait for `LiveEditPageViewReadyEvent` before publishing routed events. If `LiveEditPageInitializationErrorEvent` fires, recreate the iframe; no retry path exists.
- **Palette-drag precondition**: `CreateOrDestroyDraggableEvent(type, true)` must be published before palette drops. The hidden `<div id="drag-helper-<type>" data-portal-component-type="<type>">` owns the jQuery-UI draggable session.
- **Load-request round-trip**: `LoadComponentViewEvent` must be answered with `notify(ComponentLoaded | ComponentLoadFailed)`. Without `ComponentLoaded`, freshly re-mounted regions will not accept drops.
- **Selection restore precondition**: wizard must fire `IframeBeforeContentSavedEvent` before triggering reload; otherwise selection is lost.
- **Sortable lifecycle after load**: layout loads trigger `createSortableLayout`; other loads trigger `refreshSortable`.
- **Drag-over mutual exclusion**: exactly one `RegionView` carries the `dragged-over` class at a time.
- **Exactly-one-selected**: `SelectedHighlighter.get().getSelectedView()` is consulted in `selectItem`; any other selected view is silently deselected first.
- **UpdateText loopback guard**: `origin === 'live'` is silently dropped to prevent echo loops.

---

## Contract Asymmetries and Known Bugs

### Registration / listener asymmetries

- **`SetModifyAllowedEvent`** is handled at `LiveEditPage.ts:408-412` but missing from `PageEditor.initializeEventBus` registration (`PageEditor.ts:221-240`). Wizard must register the class on its side for cross-iframe delivery to work.
- **`ComponentLoadedEvent.on(componentLoadedListener)`** at `LiveEditPage.ts:238` is never unregistered in `unregisterGlobalListeners`. Subscription leak; `destroy` leaves a closure holding `pageView`.
- **`SetDraggableVisibleEvent.on`** at `LiveEditPage.ts:448` is never unregistered. Same pattern.
- **`MinimizeWizardPanelEvent`** is registered on the bus but never fired inside the bundle. Reserved for wizard-outbound.

### Payload shape drift

- **`ComponentViewDragCanceledEvent(componentView)`** carries a full view object; all sibling lifecycle events (`Started`, `Stopped`, `Dropped`) carry paths. Cross-iframe serialization of `ComponentView` is not registered and may fail.

### Fire-count drift (browser-dependent)

- **`ComponentViewDragStartedEvent`** and **`ComponentViewDragStoppedEvent`** fire from both draggable AND sortable handlers. On Chromium both fire for palette drags → two events with different payloads (draggable: `undefined`; sortable: `componentView.getPath()`). On Firefox only the draggable handler fires. Consumers must deduplicate.

### Asymmetric notification drift

- **`ComponentView.replaceWith`** page-root fragment branch skips `notifyItemViewAdded` (`ComponentView.ts:335` vs region branch `:328-329`). Consumers listening for add events to rebuild secondary indices must handle fragment-root replacement via `ComponentLoadedEvent` instead.

### Lock axis drift

- **`setModifyPermissions(true)`** does NOT auto-unlock (`PageView.ts:139-145` + `:121-124`). Downstream must not assume granting permission restores edit mode.
- Unlock fires `PageUnlockedEvent` AND `ComponentInspectedEvent(root)`. Initial construction lock fires `PageLockedEvent` but no mirror event.

### Inverted guard bug

- **`LiveEditPage.ts:285`**: `if (itemView && !itemView.isSelected()) { itemView.deselect(true); }` — deselects only a view that was NOT already selected. Path-based `DeselectComponentViewEvent` is a no-op for the actually-selected item.

### Template bug

- **`LiveEditPage.ts:419`**: `` `<div id="${idAttr}" ${dataAttr}}>` `` has an extra `}`. Reimplementation should render `<div id="drag-helper-<type>" data-portal-component-type="<type>"></div>` without the stray brace.

### Auto-created text payload

- **`PageView.ts:188`** fires `SelectComponentEvent` with hard-coded `rightClicked: true` for newly-created text views. Consumers gating inspector or context panels on `rightClicked` will treat auto-created text as if it were right-clicked.

### Remove-without-deselect

- **`ItemView.remove()`** skips `deselect()` and `unhighlightSelected()`. `LiveEditPage` pre-deselects on `RemoveComponentViewEvent`, so the path works through that event; but direct `view.remove()` on a selected view leaves wizard selection stale.

### `droppedListeners` never called

- **`DragAndDrop.ts:66,516-523`**: `droppedListeners` array is populated by `onDropped(cb)` but `notifyDropped` fires the class event without iterating the array. In-module `onDropped` subscribers never receive callbacks.

### Self-move not suppressed

- **`DragAndDrop.ts:306`**: dropping a component in the same region at the same index still fires `MoveComponentEvent(from, to)` with equal paths.

### Key-binding bugs

- **`PageEditor.ts:88-92`**: `case 'del'` fall-through means plain Delete never matches the `'del'` binding.
- **`PageEditor.ts:97-99`**: `case 'mod+esc'` uses keyCode 83 (S); this is a copy-paste error — it matches `Mod+S`, not `Mod+Esc`.

---

## Subsystem Clusters

- **Bootstrap / surface**: bootstrap-and-surface + inbound-router + ids-and-factory + npm EditorEvent — lifecycle, bus registration, view-factory plumbing.
- **View hierarchy**: view-base + page-view + region-view + component-view-base + specialized-component-views — parse tree, selection, keyboard, context menu.
- **Drag subsystem**: drag-and-drop spans `PageView.createDraggable/destroyDraggable` + `LayoutComponentView.createSortableLayout` + `LiveEditPage.componentLoadedListener` sortable-refresh.
- **Overlay chrome**: four absolute-positioned overlays + Cursor; called by every view on hover/select; hidden by `LiveEditPage` during drag.

---

## Key Files for Reimplementation

All under `.worktrees/master/src/main/resources/assets/js/`:

- `index.ts` — public surface
- `page-editor/PageEditor.ts` — bootstrap + bus registration + 4-event npm surface + global listeners
- `page-editor/event/EditorEvent.ts` — npm event enum + wrapper
- `page-editor/LiveEditPage.ts` — complete inbound router
- `page-editor/PageView.ts` — registry + lock state + auto-select rules
- `page-editor/ItemView.ts` — selection + hover + click + touch + context-menu + insert submenu
- `page-editor/ComponentView.ts` — component actions + replaceWith + moveToRegion + Del/Backspace
- `page-editor/RegionView.ts` — parse loop + add/remove bubbling
- `page-editor/DragAndDrop.ts` — drag lifecycle + drop rules + palette proxy integration
- `page-editor/{part,layout,text,fragment}/*ComponentView.ts` — specializations
