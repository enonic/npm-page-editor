# Architectural Regressions — iframe-side

Companion document for the full cross-repo audit in `~/repo/app-contentstudio/docs/superpowers/specs/2026-04-20-page-editor-architectural-regressions.md`. This file lists only the work that lives inside `npm-page-editor`, plus the coordination notes for changes that require matching Content Studio work.

Audit performed 2026-04-20. Three agents reviewed the v2 code, the CS bridge, and five end-to-end flows against the legacy behavior documented in `docs/legacy-spec/`. The user-visible symptoms motivating the audit: drag-and-drop fails on real CS pages but works in the integration story; changes in CS update local state but don't reach the iframe; events fired during boot are silently skipped.

Closed-gap items from `docs/gaps/` are NOT in this document — they are already implemented. Findings here are regressions that survived the gap-driven work because the story-based tests didn't exercise the real runtime conditions.

---

## How to read this

Every finding has:
- **Severity** — CRIT / HIGH / MED / LOW.
- **Legacy behavior** — what the class-based editor did, cited from `~/repo/npm-page-editor2/src/main/resources/assets/js/page-editor/` or `docs/legacy-spec/`.
- **Current behavior** — what v2 does, cited to `src/...` file:line.
- **Why it breaks** — the specific real-HTML or real-CS condition that the story doesn't exercise.
- **Fix direction** — the shape of the change, not a finished implementation.

Scope legend:
- **IF** — change stays inside `npm-page-editor`.
- **BOTH** — needs matching CS change; see the "Coordination" section.

---

## Theme D — Registry built from parse doesn't match real server HTML

Story works because it calls `setRegistry(records)` with a hand-built map. Real CS hands the iframe server HTML + descriptor snapshot and forces the iframe to derive the same registry through `parsePage` → `ensureStubs` → `rebuildIndex`. Every stage has a story-invisible failure mode.

| # | Sev | Symptom | Legacy | Current | Fix direction |
|---|---|---|---|---|---|
| D1 | CRIT | Stubs have zero intrinsic height → `document.elementsFromPoint` never finds them in real CSS grid/flex regions | Server rendered actual placeholders with real size | `reconcile.tsx:58-62` synthesizes bare `<div>` with only `data-portal-component-type` | Stub carries a class with `min-height` OR defer stub creation entirely and always let CS render fresh HTML via `load(existing:false)` |
| D2 | CRIT | `relocateInDom` inserts dragged element as direct child of region, breaking wrapper invariant (`<div class="row"><article.../></div>`) | jQuery-UI sortable used region's own direct-children structure | `component-drag.ts:64-81` uses `collectTrackedDescendants(isComponentElement)` for siblings but `insertBefore` on region directly | Walk up from the anchor's nearest common ancestor with source to preserve wrapper parents OR require CS to rerender after move |
| D3 | HIGH | Fragments leak inner `data-portal-region-name` alias; hover/selection routes to ghost | Legacy stripped `data-portal-component-type` AND `data-portal-region-name` (FragmentComponentView.ts:92-102) | `parse-page.ts:117-122` strips only component-type and region | Add `data-portal-region-name` to strip set |
| D4 | HIGH | Region-rooted fragments parse wrong; inner component ends up at path `/` | Legacy `doParseFragmentItemViews` accepted regions at root (PageView.ts:594-613) | v2's `parseFragmentPage` uses `isComponentElement` predicate → skips region root | Broaden predicate to accept region-root fragments |
| D5 | HIGH | `getPathForElement` returns `undefined` inside fragments where strip missed an alias; click becomes page-deselect | Walked up via `findParentItemViewAsHTMLElement` through stripped boundaries | `element-index.ts:15-17` no walk-up; `guards.ts:8-12` stops at first tracked ancestor | Walk up through stripped boundaries; fallback to ancestor path if direct lookup misses |
| D6 | MED | Unknown descriptor types silently become `'part'` stubs | Server rendered correct type | `reconcile.tsx:51-56` `STUBBABLE_TYPES` hardcoded, defaults to part | Propagate type verbatim OR surface `error` outgoing so CS sees schema drift |
| D7 | MED | Delete/Backspace removes selected component even when user is editing contenteditable | Legacy's keybinding was contextual to PageEditor focus | `keyboard.ts:41-48` no `activeElement` check | Skip when `document.activeElement.isContentEditable` or matches `input`/`textarea` |

---

## Theme E — Reconcile races with interactions

v2's MutationObserver + page-state snapshot + incremental DOM mutations interact in ways the story never triggers. The story never sends page-state mid-interaction, has no MutationObserver on body, and has no network latency between load-request and HTML injection.

| # | Sev | Symptom | Legacy | Current | Fix direction |
|---|---|---|---|---|---|
| E1 | CRIT | `pendingPageStateSync` clears on *any* page-state arrival; next MutationObserver reconcile runs against stale descriptors | No pending-sync concept; synchronous bus | `init.tsx:120-124, 131-135` | Match with correlation id (sender includes a seq; clear only on matching response) OR auto-clear after N ms as a safety net |
| E2 | HIGH | `rebuildIndex` replaces element→path WeakMap during drag; mid-drag hit-tests return undefined | `viewsById` mutated incrementally, refs stayed valid | `element-index.ts:6-13` new WeakMap every reconcile | Guard `rebuildIndex` during `isDragging()` OR merge into existing map instead of replacing |
| E3 | HIGH | Selection restore flushes on first reconcile if triggered by initial-HTML MutationObserver *before* config+descriptors arrive → sessionStorage cleared | Restore was after tree build, one-shot, synchronous | `persistence.ts:51-56, 40-43` | Don't flush until both config and descriptors have landed; track via init-readiness flag |
| E4 | HIGH | `inferDropTarget` reads `getComputedStyle(regionElement)` every mousemove; reconcile mid-drag can swap element ref | jQuery-UI owned region ref for the session | `drop-target.ts:58-80` resolves region from registry each call | Pin element ref at drag-start; don't re-read from registry on every mousemove |
| E5 | MED | `syncDragEmptyRegions` only checks immediate parent emptiness; moving out of nested layout doesn't dim grandparent | Legacy walked `RegionView.hasOnlyMovingComponentViews()` up the view tree | `reconcile.tsx:331-335` | Walk up ancestor regions to compute effective-empty |
| E6 | MED | Placeholder islands destroyed then recreated when CS `innerHTML` replaces a component; placeholder mounts alongside new content | Legacy used class toggle on the element itself, no separate DOM node | `reconcile.tsx:198` + `syncPlaceholders` | Detect `innerHTML` replacement (host disconnected) and reparent/recreate consistently |
| E7 | LOW | `resetRootLinks` rewrites real server `<a href>` to `#` on every reconcile; legitimate link targets lost | Legacy intercepted click events without mutating href (ItemView.ts:250-252) | `reconcile.tsx:215-221` | Remove href mutation; rely on click-interception only |

---

## Theme F — EditorEventHandler races + XSS

F1 and F2 are iframe-side despite the handler living in the CS repo — they modify expectations the iframe has about the load-response contract. Adding the contract in v2 reduces the surface CS has to get right.

| # | Scope | Sev | Symptom | Legacy | Current | Fix direction |
|---|---|---|---|---|---|---|
| F1 | IF | HIGH | Iframe-initiated `load` → CS fetch → `replaceWith` happens without re-verifying element still in DOM; if user removed component during fetch, load injects into detached subtree | Legacy fetched and injected via ComponentLoaded round-trip after tree synchronized | `EditorEventHandler.ts:38-57` | Expose an iframe-side helper `editor.getElement(path)` and document that CS MUST re-check `editor.getElement(path) === originalElement` before replacing. Fail the load otherwise |
| F2 | IF | CRIT | Non-fragment component HTML parsed via `innerHTML` with no sanitization; XSS surface through server output | Legacy's pipeline was different | `EditorEventHandler.ts:55` | **Chosen:** consumer-side sanitization. `EditorOptions.onComponentLoadRequest` JSDoc documents the rule; CS must sanitize with DOMPurify before `replaceWith`. v2 stays dependency-free. |
| F3 | BOTH | MED | `X-Has-Contributions` header triggers `requestPageReload`; multiple fast drops race, multiple reloads created | Legacy same contract but debounced at wizard | iframe emits `page-reload-request` on every fetch with the header | See Coordination: debounce on both sides |

---

## Theme H — Silent drift / lifecycle gaps (iframe-side)

| # | Sev | Symptom | Legacy | Current | Fix direction |
|---|---|---|---|---|---|
| H3 | LOW | Context menu not fully dismissed if palette drag starts over it | N/A | `context-window-drag.ts:62-84` calls close but overlay re-renders | Force overlay-render-cycle dismiss on `create-draggable` |
| H4 | LOW | `FragmentComponentView` inconsistency: page-root fragment `replaceWith` skips `notifyItemViewAdded` (G18 tail) | Legacy spec audit flagged it | Carried through in v2's reconcile | Normalize: emit consistent event for fragment-root replacement |

---

## Theme I — Interaction-semantics divergences (iframe-side)

Surfaced by the five-flow scenario trace.

| # | Scope | Sev | Symptom | Legacy | Current | Fix direction |
|---|---|---|---|---|---|---|
| I1 | IF | CRIT | Deleting a component triggers N−1 `load(existing:true)` concurrent fetches because every surviving sibling's path shifts (index-based `ComponentPath`) and `entryChanged(prev, curr)` returns true for the old-index entries | Legacy used numeric `ItemViewId` tied to DOM nodes; sibling shifts didn't trigger reloads | `reconcile.tsx:103-139` compares descriptors by path key only | Use stable per-content identity (stamp `data-live-edit-id` like legacy, or persist a descriptor-UUID across moves) to decide whether to reload. `entryChanged` keyed on content-identity, not path |
| I2 | IF | HIGH | After delete, DOM child is left orphaned — reconcile removes from records but never removes the DOM element; shows as an empty-part placeholder | Legacy `removeComponentView` removed the DOM via `ItemView.remove()` | No DOM removal in reconcile — only `load → replaceWith` mutates the DOM | Reconcile must detach DOM for paths present in `parsedRecords` but absent from descriptors |
| I4 | IF | HIGH | "Layout cell is single-slot" is a hard-coded heuristic; real pages have regions in layouts with `maxOccurrences > 1` and drops are wrongly rejected | Legacy delegated to server-provided region `maxOccurrences` | `drop-target.ts:129` `isLayoutCellOccupied` — explicit TODO comment confirms | Add `maxOccurrences` to descriptor; validate against real cap |
| I5 | IF | MED | Placeholder anchor `<div data-pe-drag-anchor>` inserted inline becomes a grid/flex item in real layouts; `computeInsertionIndex` includes its own layout shift | Legacy placeholder was absolute-positioned in `Body.get()`, didn't participate in region layout | `drop-target.ts:186-213` inserts as real DOM child | Decouple placeholder from region layout (absolute-position over the region) OR measure insertion index against siblings BEFORE anchor insertion |
| I3 | BOTH | HIGH | Controller switch fans out N concurrent `load(existing:true)` fetches against old DOM before `X-Has-Contributions`-triggered reload; `replaceWith` calls race the reload | Legacy reloaded cleanly on controller change | Reconcile kicks in the moment descriptors change | See Coordination: iframe short-circuits reconcile when `/` descriptor changed OR CS triggers reload before pushing new `page-state` |
| I6 | BOTH | MED | Palette drag session exists only as a nanostore object — no DOM helper — and the compensation hook in `LiveEditPageProxy:410` (calls `notifyComponentDragStopped` inside `drag-dropped`) is load-bearing | Legacy had real DOM helper `<div id=drag-helper-type>` + jQuery-UI draggable keeping parent drag alive | v2 stateless drag + CS compensation | See Coordination: make `drag-stopped` fire on success too so CS can stop compensating |
| I9 | IF | MED | `drag-stopped` fires ONLY on cancel (`context-window-drag.ts:43`). Legacy fired on both paths | Both success and cancel (even double on Chromium) | One-path | Fire `drag-stopped` on success after `drag-dropped`; consumer deduplicates by tracking session state |
| I10 | IF | LOW | Selection event payload lost `newlyCreated` and `rightClicked` discriminators on plain-click path | Legacy `SelectComponentEvent` carried both | `selection.ts:56-60` carries `rightClicked` only for contextmenu | Restore discriminators in all paths |

---

## Coordination (BOTH-scope findings)

Four findings require matching CS changes. The shape of the coordination is:

### A4 — Config in descriptor

**iframe-side:** Add a `configHash` (or full `config` blob) field to `PageDescriptorEntry` in `protocol/descriptor.ts`. Teach `entryChanged` in `reconcile.tsx:103-111` to compare it.

**CS-side:** `pageStateToDescriptor.ts` must serialize each component's config (hash or full) into the descriptor entry.

Without both, page-config edits in CS's InspectPanel update local state and even fire `page-state` push — but the iframe's `entryChanged` returns false and no reload happens. This is the single most visible symptom of "can't update without save."

### F3 — Debounce page-reload

**iframe-side:** Mark a `reloadRequested` flag on send; clear on subsequent reload completion. Coalesce duplicate requests within a frame.

**CS-side:** Debounce `page-reload-request` at `LiveEditPageProxy:457` so back-to-back reloads collapse into one.

### I3 — Controller transition

**CS-side:** Detect when `/`-descriptor type or descriptor key changes (controller switch) in the `onPageUpdated` handler. Before pushing a new `page-state`, either trigger a clean iframe reload via `widgetRenderingHelper.render(...)` OR at minimum suppress the `page-state` push until the new iframe generation is ready.

**iframe-side:** As a defensive fallback, detect `/`-descriptor identity change in `reconcilePage` and short-circuit reconcile (no `ensureStubs`, no `load` fan-out); wait for either a fresh `init` or a `page-reload-request` to be acknowledged. Avoids the fan-out-then-reload race.

### I6 — Palette drag ended signal

**iframe-side:** Fire `drag-stopped` on successful drop as well as cancel (see I9). This single change removes the need for the CS compensation.

**CS-side:** Simplify `LiveEditPageProxy.listenToLivePageEvents` to remove the `notifyComponentDragStopped()` call inside the `drag-dropped` case; rely on the canonical `drag-stopped` outgoing.

---

## Priority for iframe-side work

**Phase 1 — unblock real interactions (critical)**
1. **D1** — `[DONE]` stubs carry inline `min-height`/`min-width` so `elementsFromPoint` lands on them in grid/flex regions. `reconcile.tsx:synthesizeStubElement`.
2. **I1** — `[DONE]` tracked elements are stamped with `data-pe-instance-id`; `entryChanged` compares against a per-instance snapshot so sibling index shifts after a delete no longer fire `load(existing=true)` on survivors. `reconcile.tsx:snapshotByInstance`, `computeLoadTargets`.
3. **I2** — `[DONE]` reconcile detaches DOM for paths that disappear from descriptors (guarded by `prevDescriptors` so first-reconcile doesn't wipe server HTML). `reconcile.tsx:detachOrphans`.
4. **F2** — `[DONE iframe-side]` consumer-sanitization contract codified in `EditorOptions.onComponentLoadRequest` JSDoc. CS side: DOMPurify already used for fragments (`wrapLoadedFragmentHtml`); extend to non-fragment components in `EditorEventHandler.ts:55`.
5. **A4 (half)** — `[DONE iframe-side]` `configHash` field on `PageDescriptorEntry` + compared in `entryChanged`. CS-side serialization still pending.

**Phase 2 — unblock drag-and-drop on real pages (high)**
6. **D2** — `[DONE]` `relocateInDom` walks up through wrappers that hold only the tracked source (`findSlotAncestor`) and moves the slot, preserving layout wrappers like `<div class="row"><article/></div>`.
7. **E1** — `[DONE]` `pendingPageStateSync` now keyed by a monotonic `syncId` stamped on outgoing `move` / `drag-dropped` and echoed by CS on `page-state.syncId`. A 3s safety-net timeout prevents deadlock when CS hasn't yet been updated. `init.tsx:armPendingSync`.
8. **E2** — `[DONE]` `setElementIndexFrozen(true)` during drag sessions; `rebuildIndex` is a no-op while frozen so mid-drag hit-tests keep returning valid paths even if a reconcile path bypasses `isDragging()`.
9. **E4** — `[DONE]` `ActiveDrag` pins `sourceRegionElement` at drag-start; `relocateInDom` uses the pinned ref so the move survives registry churn.
10. **I4** — `[DONE iframe-side]` `maxOccurrences` propagates from `PageDescriptorEntry` into `ComponentRecord`; `isRegionAtCapacity` enforces real caps; layout single-slot is kept as a fallback when the descriptor hasn't declared a cap. CS still needs to serialize the field.
11. **I5** — `[DONE]` placeholder anchor is now `position: fixed`; its viewport coords are computed from adjacent siblings' rects. Siblings no longer shift under it, eliminating the mousemove oscillation.
12. **D3–D5** — `[DONE]` fragment strip now covers `data-portal-region-name` (D3); `parseFragmentPage` accepts region roots and preserves the declared region name in the path (D4); `getPathForElement` walks up the DOM to find a registered ancestor (D5).

**Phase 3 — UI consistency (high)**
13. **E3** — `[DONE]` `reconcilePage` now gates the `page-ready` emit and `flushSelectionRestore` on both `initReady` (set from `onPageState`) and `$config.get() != null`. Initial-HTML MutationObserver reconciles before `init` / `page-state` land no longer burn the one-shot restore. `reconcile.tsx:markInitReady`, `init.tsx:onPageState`.
14. **I9** — `[DONE]` `drag-stopped` now fires on both success and cancel paths in `component-drag.ts:endDrag` and `context-window-drag.ts:destroySession`. Outgoing order on success: `move`/`add` → `drag-dropped` → `drag-stopped`. Consumers dedup by session state. CS can now drop the `notifyComponentDragStopped()` compensation inside its `drag-dropped` handler (see I6 coordination).
15. **I3 (defensive half)** — `[DONE]` `reconcilePage` detects `/`-descriptor identity change and latches `controllerSwitched`; subsequent reconciles short-circuit (no `ensureStubs`, no `load` fan-out) until `resetPageReadyFlag()` fires on destroy / new init. `reconcile.tsx`.

**Phase 4 — correctness polish (medium)**
16. **D6, D7, E5, E6, E7, F1, F3 (iframe debounce), I10**.
   - **D6** — `[DONE]` descriptor entry `type` is propagated verbatim by `stubType` (no silent `part` default).
   - **D7** — `[DONE]` `keyboard.ts:isEditableActiveElement` short-circuits Delete/Backspace when focus is inside an `<input>`, `<textarea>`, or contenteditable element. The component-remove path and the editor-combo fallthrough are both skipped so the keystroke reaches the browser intact.
   - **E5** — `[DONE]` `reconcile.tsx:isSubtreeSourceOnly` recursively checks every descendant when deciding whether a region is effectively empty during drag. Grandparent regions that end up containing only the moving subtree (via a nested layout) now receive a drag-time placeholder too.
   - **E6** — `[DONE]` `syncPlaceholders` reuse check requires `current.island.host.parentElement === record.element`. `replaceWith` (fresh element ref) and in-place `innerHTML` replacement (orphaned host) both force a clean rebuild; no more stale placeholder hosts mounted alongside fresh server content.
   - **E7** — `[DONE]` `resetRootLinks` removed. `initNavigationInterception` already captures clicks at the document root with `capture: true` and short-circuits anchor navigation via `navigate` messages, so the href mutation was redundant and destroyed legitimate link targets.
   - **F1** — `[DONE iframe-side]` `EditorOptions.onComponentLoadRequest` and `PageEditorInstance.getElement` JSDoc now document the re-verify-before-replaceWith contract: capture the original element on request, re-call `getElement(path)` before injection, and drop the response if the reference has changed or is disconnected.
   - **F3 (iframe debounce)** — `[DONE]` `instance.requestPageReload` gates emits behind `reloadRequestPending`; the flag clears on the next animation frame (or microtask when `requestAnimationFrame` is unavailable). Synchronous bursts (fast successive drops) coalesce into one outgoing `page-reload-request`. CS-side debounce still pending.
   - **I10** — `[DONE]` `OutgoingMessage.select` requires both `rightClicked` and `newlyCreated`; every send site (`selection.ts`, `actions/definitions.ts`, `persistence.ts`, `components/Shader.tsx`) populates them explicitly. Plain left-click now carries `rightClicked: false, newlyCreated: false` instead of omitting them, restoring the legacy discriminator shape.

**Phase 5 — residuals (low)**
17. **H3, H4**.

---

## Cross-reference

The full cross-repo audit, including all 17 CS-side findings and the 4 architectural-mismatch diagnosis, lives at:

```
~/repo/app-contentstudio/docs/superpowers/specs/2026-04-20-page-editor-architectural-regressions.md
```

When implementing any BOTH-scope item (A4, F3, I3, I6), update both documents: mark the finding resolved in this file and cross-reference the CS-side PR in the app-contentstudio document.

## Test fixture

Recommended: a Storybook story built from the sample blog HTML the user pasted during the 2026-04-20 audit (real server-rendered Superhero blog with wrapper `<article>`, `<aside>`, nested `<ul>` widgets, fragment-in-layout, empty placeholder parts at top of main region). Unlike the current integration story, this fixture must exercise the full `init → page-state → reconcile → load` pipeline via a mock channel — NOT `setRegistry()`. Unit tests per reducer/parse fix; Playwright scenarios covering the five flows from the scenario-trace audit.

<sub>*Drafted with AI assistance as part of the 2026-04-20 architectural audit.*</sub>
