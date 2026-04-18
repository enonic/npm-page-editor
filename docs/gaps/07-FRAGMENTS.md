# 07 — Fragments

Covers fragment-specific behavior parity with legacy (inner-content selection, fragment-containing-layout drop guard, top-fragment action restrictions) and the missing outgoing message for binding a specific fragment content to a dropped fragment slot.

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

## G25 — `set-fragment-component` outgoing

### Problem

Legacy CS listens to `SetFragmentComponentEvent` at `LiveEditPageProxy.ts:495–499` with payload `{path, contentId}`. The editor fires it when a user drags a **specific existing fragment content** from the CS content tree/browser into the page — "bind this path to fragment-content X."

v2 has no equivalent outgoing message. `create-draggable` carries only `componentType: string`, so the iframe has no way to distinguish a drag-in of a specific fragment from a drag-in of a generic fragment slot.

### Decision

Two protocol changes:

**1. Extend `create-draggable` with optional `contentId`:**

```ts
// src/protocol/messages.ts — IncomingMessage
| {type: 'create-draggable'; componentType: string; contentId?: string}
```

When CS starts a palette drag for a specific fragment content, it passes the content's ID. The iframe's `context-window-drag` session holds the `contentId` through the drag.

**2. Add the outgoing message:**

```ts
// OutgoingMessage
| {type: 'set-fragment-component'; path: ComponentPath; contentId: string}
```

### Drop behavior

`src/interaction/context-window-drag.ts` sends a two-message sequence on valid drop when the session carries a `contentId`:

```ts
// on valid drop:
const to = insertAt(target.regionPath, target.index);

channel.send({type: 'add', path: to, componentType: session.itemType});
if (session.contentId != null) {
  channel.send({type: 'set-fragment-component', path: to, contentId: session.contentId});
}
channel.send({type: 'drag-dropped', to});
```

- `add` creates the fragment slot structurally.
- `set-fragment-component` binds the slot to the specific fragment content.
- `drag-dropped` reports the completion.

Matches legacy's sequence of `AddComponentEvent` followed by `SetFragmentComponentEvent`. CS already has separate handlers for these in `PageEventsManager` (`notifyComponentAddRequested` and `notifySetFragmentComponentRequested`), so CS migration is a two-line find-and-replace.

### Session state change

Extend the `ContextDragSession` type in `context-window-drag.ts`:

```ts
type ContextDragSession = {
  itemType: ComponentType;
  itemLabel: string;
  visible: boolean;
  placeholderAnchor: HTMLElement | undefined;
  contentId: string | undefined;  // new
};
```

Initialized from `message.contentId` in the `create-draggable` handler; otherwise `undefined`.

---

## CS migration

### Palette drag for a specific fragment content

```ts
// Before — CS builds an event-bus draggable with extra tracker
new CreateOrDestroyDraggableEvent('fragment', true).fire();
// CS-side tracks the contentId separately and fires SetFragmentComponentEvent on drop

// After — single message with contentId
postToIframe({type: 'create-draggable', componentType: 'fragment', contentId});
// On drop, v2 fires both 'add' and 'set-fragment-component' automatically
```

### Listening to `set-fragment-component` outgoing

```ts
// parent-side handler
if (msg.type === 'set-fragment-component') {
  PageEventsManager.get().notifySetFragmentComponentRequested(msg.path, msg.contentId);
}
```

### Generic fragment drop (no pre-selected content) still works

When CS fires `create-draggable` without `contentId`, the drop produces only `add` and `drag-dropped` — no `set-fragment-component`. CS's existing "empty fragment slot" handling (if any) remains intact.

---

## Implementation checklist

1. `src/parse/parse-page.ts` — add the fragment-strip branch in `parseComponent` after the layout branch.
2. `src/protocol/messages.ts`:
   - Extend `create-draggable` with `contentId?: string`.
   - Add `set-fragment-component` to `OutgoingMessage`.
3. `src/interaction/context-window-drag.ts`:
   - Extend `ContextDragSession` with `contentId: string | undefined`.
   - Read `message.contentId` in the `create-draggable` handler; store on session.
   - On valid drop, conditionally send `set-fragment-component` between `add` and `drag-dropped`.
4. Tests:
   - `src/parse/parse-page.test.ts` — assert inner `data-portal-*` attrs stripped for fragment-in-page; preserved for layout-rooted fragments (which are parsed as layouts).
   - `src/interaction/selection.test.ts` — assert click on inner fragment content selects the fragment.
   - `src/interaction/context-window-drag.test.ts` — assert the two-message drop sequence when `contentId` present; single-message when absent.
   - `src/protocol/messages.test.ts` — shape assertions.
5. Update integration stories with a "drop specific fragment" scenario.
6. CS migration (not in this repo):
   - `LiveEditPageProxy.createDraggable` — pass `contentId` when the drag source is a specific fragment content.
   - Remove CS-side `SetFragmentComponentEvent` firing on drop; rely on v2's outgoing message.
   - Parent-side listener for `set-fragment-component` outgoing.

---

## Tradeoffs captured

- **DOM mutation during parse** — Legacy stripped the same attributes; shipping model for years without incident. Risk is low but present: custom renderer code that reads `data-portal-component-type` on inner fragment elements (non-editor consumers?) would see them stripped. Not a known consumer today.
- **Layout-rooted fragments escape the strip** — intentional. Their inner regions/components need to stay tracked and editable. The type-discrimination at parse happens because `parseComponent` evaluates `element.dataset.portalComponentType` first; a fragment content rendered as a layout parses as a layout.
- **Optional `contentId` on `create-draggable`** — keeps backward compat for generic-fragment drops (empty slot). If CS never uses the generic case after migration, tighten to required (drop the `?`).
- **Two outgoing messages on drop instead of one fat one** — matches legacy split and CS's existing two-handler shape. A unified `add-with-fragment-content` would be prettier but requires CS to refactor two PageEventsManager entry points. Not worth it.

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
