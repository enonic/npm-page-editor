# 07 — Fragments

Covers fragment-specific behavior parity with legacy (inner-content selection, fragment-containing-layout drop guard, top-fragment action restrictions). G25 (`set-fragment-component` outgoing) was investigated and closed — the legacy event has no iframe emitter and the palette drag API has no source for a fragment contentId, so no v2 surface is needed.

Scope: gaps **G18** and **G25** from `docs/compatibility.md`.

---

## G18 — Fragment behavior parity

### Verification results

| Legacy behavior | v2 status | Evidence |
|---|---|---|
| Top-level fragments skip insert/remove/duplicate actions | ✅ Implemented | `src/actions/resolve.ts:83` gates these behind `!context.isTopFragment`; `src/components/ContextMenu/helpers.ts:41–44` defines the predicate. |
| Fragment-containing-layout blocked from dropping inside a layout | ✅ Implemented | `src/interaction/drop-target.ts:156` — `hasLayoutDescendant(sourcePath)` check, message key `field.drag.fragmentLayout`. |
| Strip `data-type` inside fragments to prevent inner interaction | ⚠️ Partial — one real gap | See below. |

### The remaining gap — clicks on inner fragment content

Legacy rendered a fragment, then stripped `data-type` attributes from every `[data-portal-component-type]` / `[data-portal-region]` element inside the fragment's HTML (`FragmentComponentView.ts:70–91`). Effect: any click inside the fragment would bubble past stripped children and land on the fragment wrapper, selecting the fragment.

v2 handles the registry side correctly — `parseComponent` at `src/parse/parse-page.ts:98–121` does **not** recurse into fragment children (only layouts recurse, line 109), so inner tracked elements are never registered. Inner drag/select lookups fail silently.

**But the click path still matches inner elements.** `getTrackedTarget` at `src/interaction/guards.ts:11–14` uses `element.closest('[data-portal-component-type], [data-portal-region]')`, which matches the innermost data-attributed ancestor — typically an inner fragment element that is NOT in the registry. The subsequent registry lookup returns `undefined`, and the click does nothing. Users expecting to select the fragment see no feedback.

### Decision

Strip the tracking attributes from inner fragment content during parse, matching legacy's mechanism. `closest` then naturally climbs past stripped children and finds the fragment wrapper.

```ts
// src/parse/parse-page.ts — inside parseComponent, new branch after the layout case

if (type === 'fragment') {
  const innerTracked = element.querySelectorAll('[data-portal-component-type], [data-portal-region]');
  innerTracked.forEach((el) => {
    el.removeAttribute('data-portal-component-type');
    el.removeAttribute('data-portal-region');
  });
}
```

- Runs once per parse; idempotent (subsequent parses find nothing to strip).
- Applies only when a fragment is embedded in a page (`parseStandardPage` flow). When the iframe renders a standalone fragment (`parseFragmentPage`), the fragment IS the root — the check doesn't fire against the root's descendants because `parseRootComponent` goes through `parseComponent`, which strips its own descendants if its type is `fragment`. That's correct behavior for standalone fragments with non-layout roots (you can't edit deeper than the root).
- **Layout-rooted fragments** (common case — a fragment content that IS a layout): `parseComponent` has a layout branch that recurses via `parseRegionSubtree`. Order matters — layout-recursion runs before the new fragment-strip. A fragment whose root is a layout is parsed as a layout (not fragment), so the new branch doesn't fire. Correct outcome: the layout's inner regions/components stay tracked and editable.

Edge case: a fragment whose root element has `data-portal-component-type="fragment"` and contains a layout within it (not AS it). This is an unusual render shape; current behavior strips the layout's attributes and makes it opaque — same as legacy.

### Options rejected

**Smarter matcher.** Walk `closest()` results up until we find an element in the registry. Pure logic, no DOM mutation, but every click/hover/drag path then needs registry awareness and graceful failure modes. Legacy's strip approach is one-line; matcher changes would ripple across `guards.ts`, `selection.ts`, `hover.ts`, `component-drag.ts`. Not worth it.

---

## G25 — `set-fragment-component` outgoing → CLOSED (no iframe emitter, no drag contentId)

### Verification result

Same pattern as G24 — the legacy listener has no corresponding emitter. Grep across `~/repo/app-contentstudio/modules/lib/src`, `~/repo/app-contentstudio/modules/app/src`, `~/repo/lib-admin-ui/src`, and `.worktrees/master` returns **zero** matches for `new SetFragmentComponentEvent(`. The listener at `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/LiveEditPageProxy.ts:495–499` is dead code.

Further, CS's palette drag API cannot carry a `contentId` in the first place. `LiveEditPageProxy.createDraggable` at `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/LiveEditPageProxy.ts:205` accepts only `{ type: string }` and fires `CreateOrDestroyDraggableEvent(data.type, true)` — there is no source anywhere in the CS codebase for a fragment-specific contentId at drag start. The only drag payload is a generic component-type string.

The real entry points for binding a specific fragment content are all **parent-side**:

- `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/contextwindow/inspect/region/FragmentInspectionPanel.ts:212,217` — user picks a fragment from the inspect panel's fragment-selector dropdown.
- `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/v6/features/store/page-editor/commands.ts:64` — v6 `requestSetFragmentComponent()` invoked from the inspect UI.

Actual flow today:

1. User drags a generic **`fragment` component-type** from the palette into a region. v2 fires `add` (existing behavior). CS creates an empty fragment slot.
2. CS auto-opens the fragment inspect panel.
3. User picks a specific fragment content from the selector dropdown → parent-side `notifySetFragmentComponentRequested(path, contentId)`.

No `SetFragmentComponentEvent` ever crosses the iframe boundary.

### Decision

**No v2 outgoing needed.** Do not add `set-fragment-component` to `OutgoingMessage`, and do not extend `create-draggable` with `contentId`. The existing generic-fragment drag (`add` → empty fragment slot → parent-side inspect-panel binding) already covers the shipped UX.

### CS migration

The dead `SetFragmentComponentEvent.on()` listener at `LiveEditPageProxy.ts:495–499` can be removed during CS migration, along with the `IframeEventBus.registerClass('SetFragmentComponentEvent', …)` call at `LiveEditPageProxy.ts:161`. None of the parent-side `notifySetFragmentComponentRequested()` callers are affected.

---

## Implementation checklist

1. `src/parse/parse-page.ts` — add the fragment-strip branch in `parseComponent` after the layout branch.
2. Tests:
   - `src/parse/parse-page.test.ts` — assert inner `data-portal-*` attrs stripped for fragment-in-page; preserved for layout-rooted fragments (which are parsed as layouts).
   - `src/interaction/selection.test.ts` — assert click on inner fragment content selects the fragment.
3. CS migration (not in this repo):
   - Remove the dead `SetFragmentComponentEvent.on()` listener at `LiveEditPageProxy.ts:495–499` and the matching `registerClass` call.

---

## Tradeoffs captured

- **DOM mutation during parse** — Legacy stripped the same attributes; shipping model for years without incident. Risk is low but present: custom renderer code that reads `data-portal-component-type` on inner fragment elements (non-editor consumers?) would see them stripped. Not a known consumer today.
- **Layout-rooted fragments escape the strip** — intentional. Their inner regions/components need to stay tracked and editable. The type-discrimination at parse happens because `parseComponent` evaluates `element.dataset.portalComponentType` first; a fragment content rendered as a layout parses as a layout.
- **`set-fragment-component` outgoing closed** — verification found no iframe emitter, and CS's palette drag API has no source for a per-content `contentId`. If a future feature adds a "drag a specific fragment content from the content tree" entry point, reintroducing is straightforward: one outgoing message, `contentId` on `create-draggable`, a two-message drop sequence.

---

## Cross-references

- Compatibility audit: `docs/compatibility.md` (G18, G25)
- Palette drag protocol: `docs/gaps/05-PALETTE-DRAG.md`
- Mutations protocol: `docs/gaps/04-MUTATIONS.md`
- Legacy fragment view: `.worktrees/master/src/main/resources/assets/js/page-editor/fragment/FragmentComponentView.ts`
- Legacy set-fragment event: `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/page-editor/event/outgoing/manipulation/SetFragmentComponentEvent.ts`
- CS bridge (set-fragment listener): `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/LiveEditPageProxy.ts:495–499`
- v2 parse: `src/parse/parse-page.ts`
- v2 drag session: `src/interaction/context-window-drag.ts`
- v2 protocol: `src/protocol/messages.ts`
- v2 actions / context menu helpers: `src/actions/resolve.ts`, `src/components/ContextMenu/helpers.ts`

<sub>*Drafted with AI assistance*</sub>
