# Gaps Index

Rollup of every gap identified in `docs/compatibility.md` with its final verdict and the doc that owns the full rationale. Eight topic docs, twenty-eight gaps.

## Status legend

| Marker | Meaning |
|---|---|
| 🔴 FIX | Real protocol/behavior change required before CS migration |
| 🟡 VERIFY | Behavior likely correct; needs a test to confirm, cheap fix if not |
| 🟢 DONE | Already implemented in v2; no action needed |
| ⚫ WONT-FIX | Explicitly closed with rationale; re-open if assumptions change |

## Full gap table

| # | Gap | Status | Topic doc |
|---|---|---|---|
| G1 | `load` payload lost `existing` flag | 🔴 FIX | [03-LOAD-COMPONENT](03-LOAD-COMPONENT.md) |
| G2 | `init` payload shape | 🔴 FIX | [01-INIT](01-INIT.md) |
| G3 | `select.silent` flag ignored | 🔴 FIX | [08-RESIDUALS](08-RESIDUALS.md) |
| G4 | `add`/`remove`/`move`/`duplicate`/`reset` no-op | 🔴 FIX | [04-MUTATIONS](04-MUTATIONS.md) |
| G5 | Palette drag protocol | 🟢 DONE (mis-labeled in audit) | [05-PALETTE-DRAG](05-PALETTE-DRAG.md) |
| G6 | Text update incoming | 🔴 FIX | [06-TEXT-UPDATE](06-TEXT-UPDATE.md) |
| G7 | `IframeBeforeContentSavedEvent` hook | ⚫ WONT-FIX | [08-RESIDUALS](08-RESIDUALS.md) |
| G8 | `SkipLiveEditReloadConfirmationEvent` | ⚫ WONT-FIX | [08-RESIDUALS](08-RESIDUALS.md) |
| G9 | `move` vs `drag-dropped` naming | 🟢 DONE (non-issue) | [08-RESIDUALS](08-RESIDUALS.md) |
| G10 | In-place text editor | ⚫ WONT-FIX (product decision) | [06-TEXT-UPDATE](06-TEXT-UPDATE.md) |
| G11 | `PageResetEvent` vs `ResetComponentEvent` | 🔴 FIX | [04-MUTATIONS](04-MUTATIONS.md) |
| G12 | `PageLockedEvent` / `PageUnlockedEvent` outgoing | ⚫ WONT-FIX | [08-RESIDUALS](08-RESIDUALS.md) |
| G13 | Init-error outgoing channel | 🔴 FIX | [01-INIT](01-INIT.md) |
| G14 | `ready` semantics drifted | 🔴 FIX | [01-INIT](01-INIT.md) |
| G15 | Delete key removes selected | 🔴 FIX | [08-RESIDUALS](08-RESIDUALS.md) |
| G16 | Long-touch context menu | 🟡 VERIFY | [08-RESIDUALS](08-RESIDUALS.md) |
| G17 | Select-parent + insert submenu | 🟢 DONE | [08-RESIDUALS](08-RESIDUALS.md) |
| G18 | Fragment inner-element click | 🔴 FIX (one of three behaviors) | [07-FRAGMENTS](07-FRAGMENTS.md) |
| G19 | Shader scroll prevention | 🟡 VERIFY | [08-RESIDUALS](08-RESIDUALS.md) |
| G20 | Link classification | 🔴 FIX | [08-RESIDUALS](08-RESIDUALS.md) |
| G21 | `getContent()` replacement | 🔴 FIX | [03-LOAD-COMPONENT](03-LOAD-COMPONENT.md) |
| G22 | Idempotent init | 🔴 FIX | [01-INIT](01-INIT.md) |
| G23 | INLINE / preview-only mode | 🔴 FIX | [02-PREVIEW-MODE](02-PREVIEW-MODE.md) |
| G24 | `CustomizePageEvent` outgoing | 🔴 FIX | [04-MUTATIONS](04-MUTATIONS.md) |
| G25 | `SetFragmentComponentEvent` outgoing | 🔴 FIX | [07-FRAGMENTS](07-FRAGMENTS.md) |
| G26 | `TextEditModeChangedEvent` outgoing | ⚫ WONT-FIX | [06-TEXT-UPDATE](06-TEXT-UPDATE.md) |
| G27 | `ShowWarningLiveEditEvent` outgoing | ⚫ WONT-FIX | [08-RESIDUALS](08-RESIDUALS.md) |
| G28 | Keyboard event shape | 🟢 DONE (CS translates) | [08-RESIDUALS](08-RESIDUALS.md) |

**Totals:** 15 FIX · 2 VERIFY · 4 DONE · 7 WONT-FIX

## Per-topic summary

### 01 — Init & Lifecycle (G2, G13, G14, G22)

`PageConfig` unchanged at 13 fields — skipped fields explicitly documented with "re-add if…" triggers. `initPageEditor` becomes idempotent (module-scoped `currentInstance`, `console.warn` on re-call). New outgoing `{type: 'error', phase, message}` covers init/reconcile/handle failures. New outgoing `page-ready` fires after first reconcile; existing `ready` keeps "channel open" semantic.

### 02 — Preview Mode & Mount-Time Options (G23, G2-`hostDomain`)

New `initPreview(target, options?)` export for the preview iframe — small bundle, link-interception only. `EditorOptions` replaces `RendererCallbacks`: `{hostDomain?, onComponentLoadRequest?}`. Shared `hostDomain` option (not in `PageConfig` — it's a mount-time constant).

### 03 — Load-Component Flow & Data Access (G1, G21)

`load` message gains required `existing: boolean`; callback becomes `(path, existing) => void`. `PageEditorInstance` gains `getConfig()`, `getRecord(path)`, `getElement(path)`, `findRecordsByDescriptor(descriptor)`. `ComponentRecord` exported. CS's iframe-side `EditorEventHandler` shrinks ~40%; URL-building / X-Has-Contributions / DOMPurify fragment wrap stay in CS.

### 04 — Page & Component Mutations (G4, G11, G24)

Incoming protocol loses `add`/`remove`/`move`/`duplicate`/`reset` (5 no-ops → 12 variants). Outgoing counterparts stay — they're user-intent signals. `reset` unified (`isRoot(path)` helper added for CS discrimination). New outgoing `customize-page` (menu wiring in topic 8).

### 05 — Palette Drag (G5)

Already wired end-to-end via `context-window-drag.ts` subscribing to the channel directly. Only changes: one comment in adapter pointing to the delegate; CS swaps three event-bus calls for direct postMessage.

### 06 — Text Component Round-Trip (G6, G10, G26)

Iframe owns no text editing. Double-click → `edit-text` outgoing → CS opens inspect panel + focuses HTMLArea editor parent-side. New incoming `{type: 'update-text-component', path, html}` (no `origin` flag — no echo loop possible). G10 and G26 closed as intentional.

### 07 — Fragments (G18, G25)

`parseComponent` strips inner `data-portal-component-type`/`data-portal-region` when type is fragment (matches legacy; fixes click-on-inner-content). `create-draggable` gains optional `contentId`; new outgoing `{type: 'set-fragment-component', path, contentId}` fires alongside `add` on drop when `contentId` present.

### 08 — Residuals (G3, G7, G8, G9, G12, G15, G16, G17, G19, G20, G27, G28)

Three real fixes (silent select, Delete-key-removes, link classification). Two verifications (long-touch menu, shader scroll). Two non-issues (`move` exists, menu actions complete). Four closures (before-save hook, skip-reload, lock-state outgoing, warning events). v2's typed `keyboard-event` shape kept; CS translates in a 5-line shim.

## Protocol delta summary

### Incoming message changes

| Change | Detail |
|---|---|
| Added | `update-text-component` (G6) |
| Changed | `load` gains required `existing: boolean` (G1) |
| Changed | `create-draggable` gains optional `contentId?: string` (G25) |
| Removed | `add`, `remove`, `move`, `duplicate`, `reset` no-ops (G4) |
| Honored | `select.silent` flag (G3) |

### Outgoing message changes

| Change | Detail |
|---|---|
| Added | `page-ready` after first reconcile (G14) |
| Added | `error` with phase + message (G13) |
| Added | `customize-page` (G24) |
| Added | `set-fragment-component` (G25) |

### Public API changes

| Change | Detail |
|---|---|
| New entry point | `initPreview(target, options?)` (G23) |
| Signature change | `initPageEditor(root, target, options?: EditorOptions)` — `RendererCallbacks` → `EditorOptions` (G2, G23) |
| Instance additions | `getConfig`, `getRecord`, `getElement`, `findRecordsByDescriptor` (G21) |
| Behavior | Idempotent init via module-scoped `currentInstance` (G22) |
| Type exports | `ComponentRecord`, `EditorOptions`, `PreviewOptions`, `PreviewInstance` |

### Protocol helper additions

| Helper | Detail |
|---|---|
| `isRoot(path)` | `src/protocol/path.ts` (G11) |

## Recommended execution order

Ordered by dependency — later items assume earlier items landed.

1. **Init / lifecycle foundation** — topic 1 + topic 2. New options shape, instance API, `page-ready`, error channel. Everything downstream depends on it.
2. **Load-component data access** — topic 3. Unblocks CS migration of `EditorEventHandler`.
3. **Mutation protocol** — topic 4. Drop dead messages, add `isRoot`, add `customize-page`.
4. **Text update fast path** — topic 6. Single incoming addition.
5. **Fragments** — topic 7. Parse fix + set-fragment message.
6. **Residuals** — topic 8. Three fixes (G3, G15, G20), two verifications (G16, G19). Can parallelize.
7. **Palette drag cleanup** — topic 5. Adapter comment + CS-side rename.
8. **CS migration PR** — swap `PageEditor.init(true/false)` for `initPageEditor`/`initPreview`; rewire outgoing listeners.

## CS migration summary

Parent-side changes in `~/repo/app-contentstudio/modules/`:

- `app/src/main/resources/assets/js/page-editor.ts` — rewrite as `initPageEditor(document.body, window.parent, {hostDomain, onComponentLoadRequest})`
- `app/src/main/resources/assets/js/page-viewer.ts` — rewrite as `initPreview(window.parent, {hostDomain})`
- `app/src/main/resources/assets/js/EditorEventHandler.ts` — rewrite for new callback signature; use `editor.getConfig()`, `getRecord()`, `getElement()`
- `lib/src/main/resources/assets/js/app/wizard/page/LiveEditPageProxy.ts` — swap event-bus calls for `postToIframe(...)`; drop listeners for WONT-FIX events; add 5-line keyboard shim; collapse three mutation subscriptions into one `pushPageState`

<sub>*Drafted with AI assistance*</sub>
