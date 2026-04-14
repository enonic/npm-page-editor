# Step 07 — Reconcile

> SPEC ref: [reconcile.ts](../SPEC-v2.md#reconcilets)

## Goal

The central coordinator that connects parsing, state, and rendering. Triggered by the MutationObserver after DOM changes. This is the runtime heart of the editor — it keeps the reactive state in sync with the server-rendered DOM.

Pulled into its own step (rather than bundling with init) because both transport (adapter's `onPageState` callback) and drag (reconciliation guard) depend on its behavior.

## Scope

```
src/main/resources/assets/js/v2/
└── reconcile.tsx   ← coordinator: parse -> state -> placeholders -> geometry
```

### reconcile.ts

```ts
function reconcilePage(root: HTMLElement, descriptors: DescriptorMap): void;
function reconcileSubtree(element: HTMLElement, parentPath: ComponentPath, descriptors: DescriptorMap): void;
function destroyPlaceholders(): void;
```

**`reconcilePage` flow:**

1. Call `parsePage(root, {descriptors, fragment})` to get component records
2. `rebuildIndex(records)` then `setRegistry(records)` — index first so subscribers see consistent state when the store notification fires
3. Validate `$selectedPath` still exists — if the selected path's record is gone, clear `$selectedPath`, close `$contextMenu`, and send `{ type: 'deselect', path }` via `tryGetChannel()` (no-op if channel not yet initialized)
4. Validate `$hoveredPath` still exists — if the hovered path's record is gone, clear `$hoveredPath`
5. Diff against previous registry to create/destroy placeholder islands for empty or errored components/regions
6. Call `markDirty()` to trigger geometry remeasurement

**`reconcileSubtree`:** Same logic scoped to a subtree, merges result into existing registry.

**`destroyPlaceholders`:** Unmounts all placeholder islands. Called during teardown.

**Placeholder diffing:**

The reconciler maintains an internal `Map<string, PlaceholderIsland>` tracking active placeholder islands. On each reconcile:
- For each record where `empty === true` or `error === true` (non-page types) and no island exists: create a placeholder island (ComponentPlaceholder or RegionPlaceholder depending on type)
- For each existing island whose record is no longer empty/errored, no longer exists, or whose container element changed: unmount and remove
- Existing islands whose container element is unchanged and still connected are kept as-is
- This is a simple add/remove diff, not a full virtual DOM reconciliation

**Reconciliation guard (for drag):**

During an active drag (`isDragging() === true`), `reconcilePage` and `reconcileSubtree` skip registry updates and placeholder diffing. The MutationObserver still fires, but reconciliation is deferred. On drag end, a full `reconcilePage()` is triggered by the drag handler (step 10).

Note: the guard checks `isDragging()` only, not `isPostDragCooldown()`. During the post-drag cooldown window, reconciliation proceeds normally — the cooldown only affects user interaction, not registry updates.

This prevents path renumbering from invalidating `sourcePath`/`targetRegion` mid-drag.

## What replaces what

| Existing | v2 | Change |
|----------|-----|--------|
| `adapter/reconcile.tsx` | `reconcile.ts` | Standalone module, not coupled to adapter |
| Reconcile triggered by bus events | Reconcile triggered by MutationObserver | Reactive -> observation-based |
| `PageState` class from lib-contentstudio | `DescriptorMap` plain object | Remove class dependency |

## Adapting from existing code

The existing `adapter/reconcile.tsx` contains reconciliation logic but it's coupled to the bus adapter and uses lib-contentstudio types. The v2 version:
- Becomes a standalone module
- Uses v2 protocol types
- Adds the drag guard
- Uses index-before-store ordering for consistent subscriber state
- Adds automatic deselection when selected path disappears
- Manages placeholder islands internally (previously spread across bridge + reconcile)

## Dependencies

- `protocol/` — `ComponentPath`, types
- `state/` — `setRegistry`, `rebuildIndex`, `$selectedPath`, `closeContextMenu`, `isDragging`
- `parse/` — `parsePage`, `parseSubtree`
- `rendering/` — `createPlaceholderIsland` (for placeholder island management)
- `geometry/` — `markDirty`
- `transport/` — `tryGetChannel` (for sending deselect message when selected path disappears; no-op if channel not yet initialized)

## Verification

- Unit tests with JSDOM:
  - Full reconcile: parse a DOM tree, verify registry and element-index are populated
  - Selection validation: select a path, reconcile with DOM where that path is gone, verify deselect is sent
  - Placeholder diffing: reconcile with empty region -> island created; reconcile again with content -> island destroyed
  - Drag guard: set drag state, reconcile, verify registry NOT updated; clear drag, reconcile, verify registry updated
  - Batch atomicity: verify no intermediate state is visible between registry update and index rebuild
- Run `pnpm check`
