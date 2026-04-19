# Module: specialized-component-views

**Files:** `page-editor/part/PartComponentView.ts` + `PartItemType.ts` + `PartPlaceholder.ts`; `page-editor/layout/LayoutComponentView.ts` + `LayoutItemType.ts` + `LayoutPlaceholder.ts`; `page-editor/text/TextComponentView.ts` + `TextItemType.ts` + `TextPlaceholder.ts`; `page-editor/fragment/FragmentComponentView.ts` + `FragmentItemType.ts` + `FragmentPlaceholder.ts`
**LOC:** ~661 (all four specializations combined)
**Role:** Four component-type specializations. Each ships a triplet: `*ComponentView` (behavior), `*ItemType` (singleton type token), `*Placeholder` (empty visual affordance).

---

## Table of Contents

1. [Purpose](#purpose)
2. [Part](#part)
3. [Layout](#layout)
4. [Text](#text)
5. [Fragment](#fragment)
6. [Self-Registering Singletons](#self-registering-singletons)
7. [Events Fired](#events-fired)
8. [Events Listened](#events-listened)
9. [Flag and Branch Audit](#flag-and-branch-audit)
10. [Lifecycle Contract](#lifecycle-contract)
11. [Suspicious Conditions](#suspicious-conditions)

---

## Purpose

Four component-type specializations: part, layout, text, fragment. Each ships a triplet: `*ComponentView` (behavior), `*ItemType` (singleton type token for classification + context-menu config), `*Placeholder` (empty visual affordance). These are the concrete classes that the live-edit framework instantiates for every rendered component on the page.

---

## Part

**Files:** `page-editor/part/`

- `PartComponentView extends DescriptorBasedComponentView` — receives `inspectActionRequired=true`; `resetHrefForRootLink` rewrites `href` → `'#'` on root anchor; inherits `disableLinks()`. `makeEmptyDescriptorText(component)` → `'<i18n field.part> "<name>"'`.
- `PartItemType extends ComponentItemType` — singleton `get()`.
- `PartPlaceholder extends DescriptorBasedComponentViewPlaceholder` — adds class `part-placeholder`; `getType()` returns `PartComponentType`.

**What the user sees**: a part component shell with its rendered HTML. Inner `<a>` links are disabled so clicks don't navigate. When empty → part placeholder with "Part \"name\"" message.

---

## Layout

**Files:** `page-editor/layout/`

- `LayoutComponentView extends DescriptorBasedComponentView` — hosts child `RegionView`s. In constructor: `parseRegions()` clears regions, then `doParseRegions()` walks children; for each `RegionItemType` descendant, builds a `RegionView` with the layout as parent and calls `registerRegionView`.
- `LayoutItemType` singleton.
- `LayoutPlaceholder` — adds class `layout-placeholder`; `getType()` returns `LayoutComponentType`.

Key methods: `getComponentViewByPath(path)` recurses into owned regions. `getRegions()` exposes region list. `toItemViewArray()` flattens self + all region descendants. `registerRegionView` subscribes to the region's `onItemViewAdded/Removed` so deep changes bubble up through the layout as its own item-view notifications.

**What the user sees**: a layout component with nested regions visible inside. Each region behaves like a top-level region (dropzone, drag-over highlight, component list). `DragAndDrop.createSortableLayout(component)` is called after the layout finishes loading (triggered by `LiveEditPage` on `ComponentLoadedEvent`) to install sortable on the newly-appeared regions.

**Why layouts need special parsing**: a region inside a layout must be wired with the layout as its `parentItemView` AND registered on `PageView.regionViews` (via fragment-mode path or `LiveEditPage`'s handling). Simply recursing into HTML is insufficient — regions must be explicit siblings at the same level as top-page regions for drag-and-drop targeting.

**`doParseRegions` flow** (`LayoutComponentView.ts:93-116`):
- Child already `instanceof RegionView` → no-op.
- Child's `ItemType` equals `RegionItemType` → build `RegionView`; call `registerRegionView`.
- Otherwise → recurse into children.

---

## Text

**Files:** `page-editor/text/`

- `TextComponentView extends ComponentView` — NOT descriptor-based.
- `TextItemType` — singleton; `getItemTypeConfig` pushes `'edit'` onto context menu config.
- `TextPlaceholder extends ItemViewPlaceholder` — adds class `text-placeholder`; no `getType()`.

### Initial value resolution (`normalizeInitialValue`)

1. If builder `text` is defined → use it verbatim.
2. Else if `!PageState.getState() || PageState.getState().hasTemplate()` → current rendered inner HTML.
3. Else → `liveEditParams.getTextComponentData(path)`.

### `setText(text)`

Converts image `src` via `HTMLAreaHelper.convertRenderSrcToPreviewSrc(text, contentId)` and writes `innerHTML`.

### Click / double-click demultiplexer (`handleClick` override)

250ms window (`DBL_CLICK_TIMEOUT = 250`):
- Always `stopPropagation` (so parent regions can't observe).
- `event.button === 2` → also `preventDefault`.
- If `(now - lastClicked) > 250ms` → schedule single-click handler via `setTimeout` calling `super.handleClick`.
- Else → `clearTimeout` single-click, treat as double-click: select-without-menu if not selected, then fire `EditTextComponentViewEvent(path)`.
- Always update `lastClicked`.

`editAction`: fires `EditTextComponentViewEvent(path)`. Added to menu only when `!isEmpty()` at construction; `refreshEmptyState` toggles `editAction.setVisible(!isEmpty())` dynamically.

`reset()`: clears text to `''`, hides context menu.

### RTL

If `Locale.supportsRtl(lang)` → sets `dir=rtl` on element; otherwise `LangDirection.AUTO`.

**What the user sees**: inline text area with existing HTML. Single-click selects; double-click opens inline edit mode via the external `EditTextComponentViewEvent` handler (the wizard-side rich text editor). RTL content flows right-to-left when locale supports it.

---

## Fragment

**Files:** `page-editor/fragment/`

- `FragmentComponentView extends ContentBasedComponentView` — not descriptor-based.
- `FragmentItemType` — singleton.
- `FragmentPlaceholder` — adds class `fragment-placeholder`; no `getType()`.

### Constructor parsing (`parseFragmentComponents`)

Recurses children; for each element with an `ItemType`:
- Strips `data-portal-component-type` and `data-portal-region-name` so the drag-and-drop subsystem cannot target inner nodes (fragment is atomic to DnD).
- If `LayoutItemType` → sets `fragmentContainsLayout = true` (used by DnD to forbid dragging fragments-containing-layouts into layout regions).
- If `TextItemType` → rewrites inner HTML image URLs via `HTMLAreaHelper`.
- Then `handleErrors()`: if root has `data-portal-placeholder-error`, disables `detachAction` and inherited `editAction`.

`removeComponentTypeAttrs` hoists `data-portal-placeholder-error` to root if found on a descendant.

### `detachAction`

"Detach fragment" — deselects, fires `DetachFragmentEvent(path)`. Added to context menu only when `!isEmpty()`.

### Image URL rewrite

Fragments referenced from the main page carry rendered image URLs that reference the main content's render context. When displayed inline, URLs must be rewritten to preview URLs against the fragment's own content id via `HTMLAreaHelper.convertRenderSrcToPreviewSrc`.

**What the user sees**: a fragment — an embedded piece of content. Inner components render normally but cannot be selected or dragged individually (attribute stripping makes them invisible to DnD). Right-click shows "Detach fragment" action (expands fragment content back into the parent context). Edit action available via `ContentBasedComponentView`.

---

## Self-Registering Singletons

All `*ItemType.ts` files invoke `get()` at module evaluation time → eagerly populates the singleton registry on import. Without this, the types would not be discoverable by `ItemType.fromElement`.

---

## Events Fired

| Event | Payload | Source |
|-------|---------|--------|
| `EditTextComponentViewEvent` | `(path: ComponentPath)` | Text `editAction` or double-click |
| `DetachFragmentEvent` | `(path: ComponentPath)` | Fragment `detachAction` |
| (layout) `notifyItemViewAdded/Removed` | — | Layout via region bubble-up |

---

## Events Listened

- Layout: regions' `onItemViewAdded/Removed` → re-emit as layout-level.
- Text: DOM click (custom `handleClick`).

---

## Flag and Branch Audit

- `TextComponentViewBuilder.setText(value)` — sets builder.text.
- `TextComponentView.DBL_CLICK_TIMEOUT = 250` ms.
- `LayoutComponentView.doParseRegions` — if child already `instanceof RegionView` → no-op; if `ItemType` equals `RegionItemType` → build RegionView; else recurse.
- `FragmentComponentView.doParseFragmentComponents` — if `ItemType` present → strip attrs + mark layout flag; if `TextItemType` → rewrite image URLs (no recursion); else recurse.
- `FragmentComponentView.removeComponentTypeAttrs` — hoists `data-portal-placeholder-error` to root if found.
- `TextComponentView.normalizeInitialValue` — 3-way fallback (builder > rendered HTML > liveEditParams).

---

## Lifecycle Contract

- Constructor runs all parsing; post-constructor APIs are safe.
- `FragmentComponentView.containsLayout` is meaningful only after construction.
- Text's `editAction` visibility follows `refreshEmptyState`; fragment's `detachAction` is frozen after construction.

---

## Suspicious Conditions

- `LayoutComponentView.ts:100-101` — empty no-op branch for existing RegionView child silently skips re-registration.
- `FragmentComponentView.ts:85-89` — recursion strips attrs on every typed non-text element at any depth.
- `TextComponentView.ts:172-175` — unconditional `stopPropagation` means parents never observe clicks on text components (couples selection logic to text view's custom click demux).
- `FragmentComponentView.ts:106-107` — `editAction` not declared in this file; resolved via prototype chain from `ContentBasedComponentView`.
- `LayoutComponentView.ts:124` vs `:41` — direct region registration calls notifier with 1 arg (no `isNewlyCreated`); nested forwards with 2 args. Regions registered during parse are never flagged as newly-created downstream.
