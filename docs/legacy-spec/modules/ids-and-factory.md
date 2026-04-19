# Module: ids-and-factory

**Files:** `page-editor/ItemViewId.ts`, `page-editor/ItemViewIdProducer.ts`, `page-editor/ItemViewFactory.ts`
**LOC:** ~147
**Role:** Numeric per-page view identity stamped on DOM elements, plus a pluggable view factory keyed by component short name.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Public Surface](#public-surface)
3. [Why Numeric DOM-Stamped IDs](#why-numeric-dom-stamped-ids)
4. [How the Factory Is Used](#how-the-factory-is-used)
5. [Short Name to Class Mapping](#short-name-to-class-mapping)
6. [Persistence and Reset Semantics](#persistence-and-reset-semantics)
7. [Error Surfaces](#error-surfaces)
8. [Suspicious Conditions](#suspicious-conditions)

---

## Purpose

Two orthogonal pieces:

1. **Per-page numeric identity** for any editable view, stamped on DOM elements as `data-live-edit-id`. `ItemViewId` wraps a number; `ItemViewIdProducer` is the monotonic source (first id is `1`, pre-increment, per-page-load).
2. **Pluggable view factory** `ItemViewFactory` and its default implementation `DefaultItemViewFactory.createView(type, config)`, which switches on `type.getShortName()` to build the right subclass.

Files: `ItemViewId.ts`, `ItemViewIdProducer.ts`, `ItemViewFactory.ts`.

---

## Public Surface

### `ItemViewId`

- `DATA_ATTRIBUTE: 'live-edit-id'` — consumers prepend `data-` to get the DOM attribute name.
- `constructor(value: number)` — asserts `value >= 1`.
- `equals(other)`, `toNumber()`, `toString()`, `static fromString(s: string)`.

### `ItemViewIdProducer`

- `next(): ItemViewId` — pre-increments internal counter and returns the new id.

### `ItemViewFactory` (interface)

- `createView(type: ItemType, config: CreateItemViewConfig<ItemView>): ItemView`

### `DefaultItemViewFactory` (class implementing the interface)

- Default implementation; switch on `type.getShortName()`.

---

## Why Numeric DOM-Stamped IDs

The id is a small, serializable handle that a parser can write to any DOM element (`ItemView.setItemId` → `data-live-edit-id`) and read back from any descendant event target (`ItemView.parseItemId`). Because the attribute round-trips through the DOM, the editor resolves an event target to a view without a WeakMap, and `PageView.getItemViewById` (`PageView.ts:435`) can walk the stamped tree to restore references after re-parse. Numeric (vs GUID) keeps the attribute short; `Equitable` support keeps id-keyed collections consistent across iframe boundaries.

---

## How the Factory Is Used

`LiveEditPage` constructs exactly one `DefaultItemViewFactory` and one `ItemViewIdProducer` at bootstrap (`LiveEditPage.ts:155-156`). Both flow into the root `PageView` builder (`PageView.ts:102-103`); every child builder either reuses them or inherits them from the parent region (`ComponentView.ts:139-141`, `RegionView.ts:95-96`). Parsers that build child views from DOM elements assemble a `CreateItemViewConfig` (parentView, parentElement, element, liveEditParams, positionIndex) and call `factory.createView(type, config)`.

The pluggable export lets hosts ship their own `ItemViewFactory` (e.g. to wrap fragments differently) while reusing the default for other types.

---

## Short Name to Class Mapping

`DefaultItemViewFactory.createView` at `ItemViewFactory.ts:19-35`:

| Short name | Resulting class | Notes |
|-----------|-----------------|-------|
| `'fragment'` | `FragmentComponentView` | Config cast to `CreateFragmentViewConfig` for `fragmentContentId`. |
| `'layout'` | `LayoutComponentView` | |
| `'part'` | `PartComponentView` | |
| `'text'` | `TextComponentView` | `text` forwarded only if `config instanceof CreateTextComponentViewConfig`, else `null`. |
| `'region'` | `RegionView` | Only parentView, parentElement, liveEditParams, element forwarded — the region builder does NOT receive itemViewIdProducer, itemViewFactory, or positionIndex. |
| `'page'` | throws | Pages are constructed by `PageView.ts` directly, not by this factory. |
| anything else | throws | i18n key `live.view.itemtype.error.createviewnotsupported`. |

---

## Persistence and Reset Semantics

- **No id persistence across reloads.** Counter is in-memory only on the producer instance. A new producer is constructed per bootstrap; ids restart at 1. Selection persistence across reloads uses `ComponentPath`, not id.
- **No reset API.** No `reset()`, no setter, no serialization. To restart from 1, discard the producer and allocate a new one.
- **No id recycling or free list.**

---

## Error Surfaces

- `ItemViewId` constructor throws on `value < 1` (including `NaN`); `fromString('not-a-number')` produces NaN which then throws.
- `DefaultItemViewFactory.createView` throws on `'page'` or unknown short names.
- All failure modes are synchronous.

---

## Suspicious Conditions

- `ItemViewFactory.ts:82-88` — `createRegionView` silently drops `itemViewIdProducer`, `itemViewFactory`, `positionIndex`. Fallback is consumed from `builder.parentView` inside `RegionView.ts:95-96`; if a caller ever invokes the factory for a region whose config has no parentView, those fields are unresolved.
- `ItemViewFactory.ts:31-33` — `'page'` grouped with the default catch-all; callers cannot distinguish "page" from "unknown type".
- `ItemViewId.ts:44-46` — `fromString` has no validation beyond the `>= 1` assert; malformed attrs throw at the call site.
- No counter reset → correctness depends on consumers discarding the producer per page load.
