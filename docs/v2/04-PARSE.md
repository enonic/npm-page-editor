# Step 04 — Parse

> SPEC ref: [parse/](../SPEC-v2.md#parse)

## Goal

DOM scanning that reads `data-portal-*` attributes and builds `ComponentRecord` entries. Pure functions — take DOM elements and descriptor maps, return flat record maps. No store mutations, no side effects.

## Scope

```
src/main/resources/assets/js/v2/parse/
├── parse-page.ts      ← full page DOM walk -> Record<string, ComponentRecord>
├── parse-subtree.ts   ← scoped subtree re-parse
├── emptiness.ts       ← content detection, editor-element filtering
└── index.ts           ← barrel export
```

### parse-page.ts

```ts
type DescriptorMap = Record<string, { descriptor?: string; fragment?: string; name?: string }>;

type ParsePageOptions = {
  fragment?: boolean;
  descriptors?: DescriptorMap;
};

function parsePage(body: HTMLElement, options?: ParsePageOptions): Record<string, ComponentRecord>;
```

Options object keeps the public API extensible. `fragment` tells the parser to treat the first component element as the root (used for fragment content).

Walks the DOM recursively. For each element:
- `data-portal-component-type` attribute -> component type
- `data-portal-region` attribute -> region
- Computes `ComponentPath` from position in tree (region name + child index within parent)
- Checks emptiness via `isNodeEmpty()`
- Checks error via `data-portal-placeholder-error` attribute
- Resolves descriptor from `descriptors` map using computed path
- Builds parent/children relationships

Returns a flat `Record<string, ComponentRecord>` keyed by path string.

### parse-subtree.ts

```ts
type ParseSubtreeOptions = {
  fragment?: boolean;
  descriptors?: DescriptorMap;
};

function parseSubtree(
  rootElement: HTMLElement,
  rootPath: ComponentPath,
  options?: ParseSubtreeOptions,
): Record<string, ComponentRecord>;
```

Same logic scoped to a single subtree. `rootPath` is the path of the element being reparsed. Used after targeted DOM mutations when a full page re-parse isn't needed. Delegates to `parsePage` when `rootPath` is `'/'`. Merges into existing registry at the reconcile layer.

### emptiness.ts

```ts
function isNodeEmpty(element: HTMLElement): boolean;
function isEditorInjectedElement(element: Element): boolean;
```

`isNodeEmpty` checks whether an element has meaningful content, excluding editor-injected elements.

`isEditorInjectedElement` identifies elements injected by the editor:
- `[data-pe-placeholder-host]` — placeholder islands
- `[data-pe-drag-anchor]` — drag handles
- Overlay host element

DOM selectors used throughout parsing:
- `[data-portal-component-type]` — component elements
- `[data-portal-region]` — region elements
- `data-portal-placeholder-error` — error marker attribute

## Adapting from existing code

The existing `parse/` directory is very close to what v2 needs. Main changes:

| Existing | v2 | Change |
|----------|-----|--------|
| `ComponentPath` from lib-contentstudio | `ComponentPath` from `protocol/path.ts` | Use branded string + utility functions |
| `PageState` from lib-contentstudio | `DescriptorMap` (plain object) | Remove class dependency |
| `parse-page.ts` imports `PageState` | Accepts `DescriptorMap` directly | Simpler interface |

The parsing logic itself (DOM walk, attribute reading, tree building) stays essentially the same.

## Dependencies

- `protocol/` — `ComponentPath` type and utility functions (`fromString`, `append`, `insertAt`, etc.), `ComponentType`
- `state/registry` — `ComponentRecord` type (type-only import, no runtime dependency)

Note: parse has no runtime dependency on `state/`. The `ComponentRecord` type import is compile-time only. Parse produces records but doesn't write to the registry — that's the reconciler's job (step 07).

## Verification

- Unit tests with JSDOM fixtures: create HTML with `data-portal-*` attributes, verify parsed records match expected tree
- Edge cases: empty regions, nested layouts, error markers, fragments, mixed content with editor-injected elements
- Emptiness tests: elements with only whitespace, elements with editor placeholders, elements with real content
- Run `pnpm check`
