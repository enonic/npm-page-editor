# Step 02 — State

> SPEC ref: [state/](../SPEC-v2.md#state)

## Goal

Define all reactive state as nanostores atoms, one file per concern. State files only import from `protocol/` for types. Each file exports its atom(s) and pure setter/getter functions.

## Scope

```
src/main/resources/assets/js/v2/state/
├── registry.ts       ← $registry MapStore<Record<string, ComponentRecord>>
├── selection.ts      ← $selectedPath WritableAtom
├── hover.ts          ← $hoveredPath WritableAtom
├── drag.ts           ← $dragState WritableAtom + isDragging + isPostDragCooldown
├── page.ts           ← $locked, $modifyAllowed, $config, $pageControllers
├── context-menu.ts   ← $contextMenu WritableAtom
├── element-index.ts  ← WeakMap element->path, rebuildIndex, getPathForElement
└── index.ts          ← barrel export
```

### registry.ts

`ComponentRecord` type (moved from `types.ts`):

```ts
type ComponentRecord = {
  path: ComponentPath;
  type: ComponentType;
  element: HTMLElement | undefined;
  parentPath: ComponentPath | undefined;
  children: ComponentPath[];
  empty: boolean;
  error: boolean;
  descriptor: string | undefined;
  loading: boolean;
};
```

Exports: `$registry`, `setRegistry`, `getRecord`, `updateRecord`, `removeRecord`.

### selection.ts / hover.ts

Simple atoms with getter/setter wrappers. Typed with `ComponentPath | undefined`.

### drag.ts

`DragState` type with fields from SPEC: `itemType`, `itemLabel`, `sourcePath`, `targetRegion`, `targetIndex`, `dropAllowed`, `message`, `placeholderElement`, `x`, `y`.

Key behavior:
- `setDragState` is the single entry point for starting a drag
- `isDragging()` — returns `$dragState.get() !== undefined`
- `isPostDragCooldown()` — returns `true` for 100ms after drag ends (prevents mouseup from triggering click-selection). Cooldown flag stored alongside `$dragState`, cleared via `setTimeout`.
- Mutual exclusion: `setDragState` rejects a new drag if one is already active

### page.ts

Four atoms: `$locked`, `$modifyAllowed`, `$config` (PageConfig | undefined), `$pageControllers` (PageController[]). Pure setters/getters.

### context-menu.ts

`ContextMenuState` type: `{ kind: 'component' | 'locked-page'; path: ComponentPath; x: number; y: number }`.

Exports: `$contextMenu`, `openContextMenu`, `closeContextMenu`.

### element-index.ts

`WeakMap<HTMLElement, ComponentPath>` reverse index. Rebuilt after every reconciliation.

Exports: `rebuildIndex(registry)`, `getPathForElement(element)`.

## What replaces what

| Legacy / new-ui | v2 state | Change |
|----------------|----------|--------|
| `stores/registry.ts` (single file, all atoms) | Split into 7 files by concern | One monolith -> focused files |
| `$textEditing` atom | Removed | Text editing feature dropped |
| `DragState.targetPath` (string) | `DragState.targetRegion` + `targetIndex` | Single path -> region + insertion index |
| String-typed paths in atoms | `ComponentPath` branded type | Raw strings -> typed paths |

## Adapting from existing code

The existing `stores/registry.ts` has all atoms in one file. v2 splits them. The `ComponentRecord` interface is nearly identical — main changes:
- `path` uses branded `ComponentPath` instead of lib-contentstudio class
- `parentPath` uses `ComponentPath | undefined` instead of `string | undefined`
- `DragState` gains `targetRegion` + `targetIndex` instead of `targetPath`

`element-index.ts` is adapted from existing `stores/element-index.ts` — same WeakMap approach.

## Dependencies

- `protocol/` — for `ComponentPath`, `ComponentType`, `PageConfig`, `PageController` types

## Verification

- Unit tests for `drag.ts`: mutual exclusion guard, post-drag cooldown timing
- Unit tests for `element-index.ts`: rebuild + lookup
- Unit tests for registry setters: `setRegistry`, `updateRecord`, `removeRecord`
- Run `pnpm check`
