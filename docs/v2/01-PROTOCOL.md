# Step 01 — Protocol

> SPEC ref: [protocol/](../SPEC-v2.md#protocol), [path.ts](../SPEC-v2.md#pathts), [messages.ts](../SPEC-v2.md#messagests)

## Goal

Create the public contract that Content Studio imports. Everything in `protocol/` is a leaf — no internal v2 dependencies. This module defines the language the two frames speak.

## Scope

```
src/main/resources/assets/js/v2/protocol/
├── path.ts        ← ComponentPath branded type + pure utility functions
├── messages.ts    ← IncomingMessage / OutgoingMessage discriminated unions + shared types
└── index.ts       ← barrel export
```

### path.ts

`ComponentPath` is a branded string (`string & { readonly __brand: 'ComponentPath' }`).

Functions to implement:

| Function | Signature | Notes |
|----------|-----------|-------|
| `root` | `() => ComponentPath` | Returns `"/"` |
| `fromString` | `(raw: string) => Result<ComponentPath>` | Validates and brands; returns `err` on malformed input |
| `parent` | `(path: ComponentPath) => ComponentPath \| undefined` | `undefined` for root |
| `regionName` | `(path: ComponentPath) => string \| undefined` | Last name segment |
| `componentIndex` | `(path: ComponentPath) => number \| undefined` | Last numeric segment |
| `append` | `(path, region?, index?) => ComponentPath` | Builds child path |
| `insertAt` | `(regionPath, index) => ComponentPath` | Shorthand for insertion target |
| `isRegion` | `(path: ComponentPath) => boolean` | Ends with name segment or is root |
| `isComponent` | `(path: ComponentPath) => boolean` | Ends with numeric index |
| `equals` | `(a, b) => boolean` | String comparison |
| `isDescendantOf` | `(child, ancestor) => boolean` | Prefix check |
| `depth` | `(path: ComponentPath) => number` | Segment count |

Path structure: alternating `region-name / component-index` segments. `"/"` is root. `"/main"` is a region. `"/main/0"` is a component. See SPEC for the full table.

### messages.ts

Typed discriminated unions for iframe communication. Every message envelope includes `{ version: 2, source: 'page-editor' }`.

Types to define:
- `IncomingMessage` — 17 variants (init, select, deselect, add, remove, move, load, duplicate, reset, set-component-state, page-state, set-lock, set-modify-allowed, create-draggable, destroy-draggable, set-draggable-visible, page-controllers)
- `OutgoingMessage` — 21 variants (ready, select, deselect, move, add, remove, duplicate, reset, inspect, create-fragment, save-as-template, select-page-descriptor, page-reload-request, component-loaded, component-load-failed, drag-started, drag-stopped, drag-dropped, keyboard-event, iframe-loaded, navigate)
- `ComponentType` — `'page' | 'region' | 'text' | 'part' | 'layout' | 'fragment'`
- `Modifiers` — `{ ctrl, alt, shift, meta }`
- `PageConfig` — init payload (contentId, pageName, locked, modifyPermissions, phrases, etc.)
- `PageDescriptor` — component descriptor map
- `PageController` — controller entry (descriptorKey, displayName, iconClass)

### index.ts

Re-export everything from `path.ts` and `messages.ts`.

## What replaces what

| Legacy / new-ui | v2 protocol | Change |
|----------------|-------------|--------|
| `ComponentPath` class from `@enonic/lib-contentstudio` | Branded string + pure functions | Class with methods -> type + utilities |
| Event classes (`SelectComponentEvent`, `DeselectComponentEvent`, etc.) | `IncomingMessage` / `OutgoingMessage` unions | ~30 event classes -> 2 union types |
| `ComponentType` enum / `*ComponentType` classes from lib-contentstudio | String literal union | Class hierarchy -> union type |

## Adapting from existing code

The new-ui `types.ts` has `ComponentRecordType` which maps closely to the new `ComponentType`. The `ComponentRecord` interface stays mostly the same but gains the branded `ComponentPath` type instead of the lib-contentstudio class.

The path utility functions are new — lib-contentstudio's `ComponentPath` is a class with methods like `getParent()`, `toString()`, `getLevel()`. The v2 equivalents are standalone functions operating on branded strings.

## Dependencies

None. This is the leaf of the dependency graph.

## Verification

- Unit tests for every `path.ts` function — edge cases: root path, single-segment, deep nesting, malformed input (empty segments, negative indices, trailing slashes)
- Type tests: confirm `ComponentPath` brand prevents raw string assignment
- Run `pnpm check` — types + lint must pass
