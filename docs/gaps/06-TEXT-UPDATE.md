# 06 — Text Component Round-Trip

Documents the intentional architectural decision to move text editing out of the iframe and into the Content Studio inspect panel, plus the single remaining wire addition needed to push text updates back to the iframe DOM.

Scope: gaps **G6**, **G10**, **G26** from `docs/compatibility.md`.

---

## Product decision — text editing moves to the inspect panel

Legacy iframe supported in-place text editing via `HTMLAreaHelper` (CKEditor-based rich text editor) injected directly into the iframe DOM. v2 **does not** replicate this.

Instead:

1. User double-clicks a text component in the iframe (or selects "Edit" from the context menu).
2. v2 fires `{type: 'edit-text', path}` outgoing — unchanged from current v2 behavior.
3. CS's parent-side handler opens the inspect panel for the component and focuses the HTMLArea editor inside that panel.
4. User edits text in the inspect panel.
5. On save, CS updates its `PageState` model and pushes the new HTML to the iframe via `update-text-component` message (defined below).
6. v2 applies the HTML to the text component's DOM element directly; reconcile reruns but has no structural changes to react to.

This is a deliberate UX change: the page iframe becomes a pure rendering + structural-editing surface, and all content editing (text, images, links) is moved into the inspect panel next to it. The tradeoff is accepted — inline editing UX is sacrificed for a simpler iframe and a single, well-defined editing surface in CS.

---

## G10 — In-place text editor → WONT-FIX

v2 never implements inline text editing. No `HTMLAreaHelper` injection, no contenteditable, no rich-text UI inside the iframe.

Consequences:
- No CKEditor dependency in `@enonic/page-editor`.
- No MutationObserver fights; no `suspendReconcile`/`resumeReconcile` hooks needed.
- No echo-prevention logic; no `origin` discriminator.

If a future product direction revives inline editing, revisit. Not before.

---

## G26 — `text-edit-mode-changed` outgoing → WONT-FIX

Legacy fired this when the iframe's HTMLAreaHelper mounted or unmounted, so CS knew to switch into/out of text-edit UI state. v2 has no iframe-side edit mode to report — the editing happens entirely in CS's inspect panel, so CS already knows its own panel's state.

The `edit-text` outgoing message (`src/actions/definitions.ts:92–93`) remains the single edit-intent signal. CS's handler opens the panel and focuses the HTMLArea editor on receipt.

---

## G6 — `update-text-component` incoming message → ADD

### Shape

```ts
// src/protocol/messages.ts — IncomingMessage
| {type: 'update-text-component'; path: ComponentPath; html: string}
```

No `origin` field. v2 never emits text updates (there is no in-iframe editor), so there is no echo loop to prevent.

### Why this message instead of `page-state`

`page-state` carries descriptor metadata (descriptor keys, fragment IDs, structural tree) — it does **not** carry rendered HTML. Text content lives in each text component's DOM subtree (`element.innerHTML`). Pushing structural metadata to reconcile cannot update text content.

Two alternatives were considered and rejected:

| Alternative | Why rejected |
|---|---|
| Use `load` message to trigger a full component refetch from the portal on every text save | Adds a network round-trip per save. Portal fetch latency is not free; users save text frequently. |
| Inflate `page-state` to carry text HTML for every text component | Bloats every `page-state` message. The concern is specifically text updates; a dedicated fast path is the right shape. |

A dedicated, content-specific message is the correct boundary: `page-state` for structural mutations, `update-text-component` for content pushes.

### Adapter behavior

```ts
// src/transport/adapter.ts
case 'update-text-component': {
  const el = getRecord(message.path)?.element;
  if (el == null) break;
  el.innerHTML = message.html;
  break;
}
```

- Lookup via `getRecord(path)?.element` (same access used for DOM-replace in the load flow).
- `innerHTML` assignment mutates the element's subtree; v2's MutationObserver fires.
- Reconcile re-runs on the subtree, but a text component has no child components to re-parse, so reconcile is a practical no-op.

### XSS / trust boundary

Setting `innerHTML` is a well-known XSS vector. Accepted here because:
- CS's `HTMLAreaHelper` sanitizes content on the parent side before sending.
- The HTML source is the same-origin CS app — not arbitrary external content.
- Adding a second DOMPurify pass in v2 would pull in a large dependency for a boundary that's already trust-checked.

If CS's sanitization ever weakens or v2 is used with an untrusted sender, add DOMPurify as a defensive layer in the adapter handler. Not needed today.

---

## CS migration

```ts
// Before — LiveEditPageProxy.ts:574–582
PageState.getEvents().onComponentUpdated((event: ComponentUpdatedEvent) => {
  new PageStateEvent(PageState.getState().toJson()).fire();
  if (event instanceof ComponentTextUpdatedEvent && event.getText()) {
    if (this.isFrameLoaded) {
      new UpdateTextComponentViewEvent(event.getPath(), event.getText(), event.getOrigin()).fire();
    }
  }
});

// After
PageState.getEvents().onComponentUpdated((event: ComponentUpdatedEvent) => {
  if (!this.isFrameLoaded) return;
  postToIframe({type: 'page-state', page: PageState.getState().toJson()});
  if (event instanceof ComponentTextUpdatedEvent && event.getText()) {
    postToIframe({type: 'update-text-component', path: event.getPath(), html: event.getText()});
  }
});
```

The `origin` argument drops entirely. CS's inspect panel is the only emitter of text updates now; there's no other source to distinguish from.

CS inspect panel wiring:
```ts
// on iframe outgoing 'edit-text'
inspectPanel.openFor(msg.path);
inspectPanel.focusHtmlAreaEditor();

// on HTMLArea save
postToIframe({type: 'update-text-component', path, html: sanitizedHtml});
```

---

## Implementation checklist

1. `src/protocol/messages.ts`
   - Add `update-text-component` to `IncomingMessage` union.
   - Add `'update-text-component'` to `INCOMING_MESSAGE_TYPES`.
2. `src/transport/adapter.ts`
   - Handle the case: lookup element via registry, set `innerHTML`.
3. Tests:
   - `src/transport/adapter.test.ts` — fixture with a text component element, assert `innerHTML` is updated; assert no-op when record missing.
   - `src/protocol/messages.test.ts` — shape assertion.
4. Update `README.md` and integration stories.
5. CS migration (parent-side, not in this repo):
   - `LiveEditPageProxy.ts:574–582` — swap event-bus firing for `postToIframe({type: 'update-text-component', ...})`; drop `origin`.
   - Wire the inspect panel's `edit-text` receiver + HTMLArea save → `update-text-component` sender.

---

## Tradeoffs captured

- **UX regression vs architectural win** — Users lose click-to-type inline editing; they get a focused HTMLArea in an adjacent panel instead. Product signed off as intentional.
- **No `origin` flag** — Simpler shape; relies on the invariant that v2 never emits text updates. If that invariant ever breaks (e.g. future in-iframe text feature), we'd reintroduce origin then.
- **Dedicated message breaks "single mutation channel"** — Topic 4 committed to `page-state` as the structural-mutation channel. This is a *content* channel, not structural. Different data, different channel. Acceptable separation.
- **`innerHTML` trust** — Relies on CS-side sanitization. Single boundary, documented.

---

## Cross-references

- Compatibility audit: `docs/compatibility.md` (G6, G10, G26)
- Load-component flow (same `getRecord(path)?.element` access pattern): `docs/gaps/03-LOAD-COMPONENT.md`
- Page & component mutations (structural channel): `docs/gaps/04-MUTATIONS.md`
- Legacy text view: `.worktrees/master/src/main/resources/assets/js/page-editor/text/TextComponentView.ts`
- CS bridge (update wire-up): `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/LiveEditPageProxy.ts:574–582`
- v2 adapter: `src/transport/adapter.ts`
- v2 protocol: `src/protocol/messages.ts`
- v2 actions (edit-text outgoing): `src/actions/definitions.ts:92–93`

<sub>*Drafted with AI assistance*</sub>
