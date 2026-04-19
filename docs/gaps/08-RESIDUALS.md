# 08 — Residuals

Batched treatment of twelve smaller gaps — three real fixes, two verification tasks, and seven closed-with-rationale items. Each is sized in minutes or a single PR, not architectural. Consolidated here so future-us can see every "small decision" alongside its reasoning.

Scope: gaps **G3, G7, G8, G9, G12, G15, G16, G17, G19, G20, G27, G28** from `docs/compatibility.md`.

---

## Fixes (3)

### G3 — `select.silent` flag honored

**Problem.** `src/protocol/messages.ts:61` declares `silent?: boolean` on incoming `select`, but the adapter at `src/transport/adapter.ts:35–37` ignores it. Legacy used `silent` on selection restore-after-reload to skip scroll-into-view and highlight animation.

**Fix.** Pipe `silent` through the selection path:

```ts
// src/transport/adapter.ts
case 'select':
  setSelectedPath(message.path, {silent: message.silent === true});
  break;
```

Extend `setSelectedPath` in `src/state/selection.ts` to accept an option object or a companion atom `$silentSelection`. `SelectionHighlighter` and any scroll-into-view logic read the flag and skip visuals when set.

### G15 — Delete key removes selected component

**Problem.** `src/interaction/keyboard.ts` forwards Delete/Backspace as generic `keyboard-event` outgoing messages, but no handler downstream (v2 or CS) converts that into a `remove` action. Legacy bound Delete/Backspace on selection (`ComponentView.ts:221–241`) and fired `RemoveComponentRequest` directly.

**Fix.** In `keyboard.ts`, when Delete or Backspace fires with a selection and no modifier, send `remove` outgoing instead of forwarding as a generic keyboard event:

```ts
// conceptual addition in handleKeyEvent, before the generic forward:
const selected = $selectedPath.get();
const isDelete = (event.key === 'Delete' || event.key === 'Backspace') && !hasModifier(event);
if (event.type === 'keydown' && isDelete && selected != null && !isRoot(selected)) {
  event.preventDefault();
  channel.send({type: 'remove', path: selected});
  return;
}
```

- `isRoot` guard (from topic 4) blocks the page itself being "deleted".
- The action is destructive; firing once on `keydown` (not keyup) matches legacy behavior.
- Skip when a modifier is pressed so `Ctrl/Cmd+Delete` still forwards through to CS's generic keybinding.

### G20 — UriHelper internal-link classification

**Problem.** `src/interaction/navigation.ts:13–18` fires `{type: 'navigate', path: href}` for every non-hash, non-javascript anchor — including external URLs and same-page fragments with an absolute href. Legacy used `UriHelper.isNavigatingOutsideOfXP`, `isNavigatingWithinSamePage`, `isDownloadLink` to classify before firing (`PageEditor.ts:155–172`).

Legacy also resolved the navigation target using **`data-content-path` with `href` fallback**, not `href` alone. XP's portal rewrites internal-content anchors so they carry an SEO-friendly public `href` plus a canonical `data-content-path` attribute holding the internal XP path. Legacy's `findPath` (`PageEditor.ts:174–177`) preferred `data-content-path`:

```ts
const findPath = (a: HTMLLinkElement): string | undefined => {
  return a.dataset.contentPath || a.href;
};
```

v2's current implementation reads only `href`, so anchors with an external-looking `href` but an internal `data-content-path` are miscategorized as external and skip interception. The `navigate` payload also loses the canonical internal path CS needs to open the target in the wizard.

**Fix.** Extend `initNavigationInterception` to accept `hostDomain` (from `EditorOptions` / `PreviewOptions` per topic 2), resolve the path via `data-content-path || href`, and classify on the resolved path:

```ts
export type NavigationOptions = {
  hostDomain?: string;
};

export function initNavigationInterception(channel: Channel, options?: NavigationOptions): () => void {
  const hostDomain = options?.hostDomain;

  const resolvePath = (anchor: HTMLAnchorElement): string => {
    return anchor.dataset.contentPath || anchor.href;
  };

  const shouldIntercept = (anchor: HTMLAnchorElement): boolean => {
    if (anchor.hasAttribute('download')) return false;
    const path = resolvePath(anchor);
    if (path.startsWith('#') || path.startsWith('javascript:')) return false;
    if (path.startsWith('/')) return true;
    if (hostDomain != null && path.startsWith(hostDomain)) return true;
    return false;
  };

  // ...rest unchanged; when intercepting, send channel.send({type: 'navigate', path: resolvePath(anchor)})
}
```

- `<a download>` links skip interception (browser downloads them).
- `data-content-path` wins over `href` — matches legacy and gives CS the canonical internal path.
- Relative paths starting with `/` are always internal.
- Absolute paths are internal iff they begin with `hostDomain`.
- Everything else (other hosts, data URIs, mailto) skips.

If `hostDomain` is absent, only the relative-path case is treated as internal; absolute URLs pass through to the browser. Dev-mode `console.warn` on the first skipped absolute URL when `hostDomain` is missing — helps catch a missing `EditorOptions.hostDomain` during integration.

---

## Verifications (2)

### G16 — Long-touch context menu

**Status.** Not verified. v2 listens for `contextmenu` events at `src/interaction/selection.ts:60` (capture phase). Modern browsers emit `contextmenu` automatically on long-press (iOS Safari, iPadOS, Android Chrome), so the right-click handler likely covers touch by default — but no test confirms it.

**Action.** Add a Playwright touch-emulation test that dispatches a long-press on a component and asserts the context menu opens. If the test fails, fall back to an explicit `touchstart` + timeout handler in `selection.ts`.

Estimate: 30 min verification, ≤1 hour fix if needed.

### G19 — Shader scroll prevention

**Status.** `src/components/Shader.tsx` renders a single full-viewport overlay when the page is locked. Legacy's five-overlay shader (center + N/E/S/W) was explicitly designed so scroll events couldn't bleed through to the scrollable page behind. v2's single overlay does not demonstrably block wheel/touch-move events — depends on CSS positioning and the underlying page's scroll container.

**Action.** Manual test with a locked page taller than the viewport — if the user can scroll the underlying page through the shader, add `overscroll-behavior: contain` and `pointer-events: auto` on the shader root, and a `wheel` event handler that calls `preventDefault()`. If that's insufficient (scroll chaining on iOS), mirror legacy's five-panel structure.

Estimate: 30 min verification, ≤1 hour fix if needed.

---

## Non-issues (2)

### G9 — `move` outgoing vs `drag-dropped`

**Status.** Both messages exist in `src/protocol/messages.ts:83,100`:

```ts
| {type: 'move'; from: ComponentPath; to: ComponentPath}
| {type: 'drag-dropped'; from?: ComponentPath; to: ComponentPath}
```

`drag-dropped` fires from drag completion in `src/interaction/component-drag.ts` and `src/interaction/context-window-drag.ts`. `move` is reserved for non-drag moves (e.g., a future "move to region" menu action). CS listens to `drag-dropped` today for drag-driven moves; when menu-driven moves arrive, CS adds a `move` listener with identical handling.

No protocol change needed.

### G17 — Context menu actions

**Status.** `select-parent` is implemented at `src/actions/resolve.ts:50,60` and `src/actions/definitions.ts:67` (verified; tests at `src/actions/definitions.test.ts:140–149`). `Insert` submenu is implemented at `src/actions/resolve.ts:20–32` with all four subtypes (`insert-part`, `insert-layout`, `insert-text`, `insert-fragment`), each firing `{type: 'add', path: resolveInsertPath(path), componentType}` at `src/actions/definitions.ts:76–91`.

No work needed.

---

## Closed with rationale (5)

### G7 — `IframeBeforeContentSavedEvent` hook

**Status.** WONT-FIX.

Legacy saved the selected path to `sessionStorage` on the `IframeBeforeContentSavedEvent` CS→editor signal (pre-save checkpoint). v2's `src/persistence.ts:53–68` writes on every `$selectedPath` change, keyed by `contentId`. Functionally equivalent or better — no "lost selection if page crashes between edit and save" window.

CS's parent-side code at `LiveEditPageProxy.ts:121–125` clears stored paths on CS app window unload; this is a separate cleanup concern that doesn't depend on the iframe signal.

**Re-open if** a specific save-time-only operation emerges that v2's continuous writes can't satisfy.

### G8 — `SkipLiveEditReloadConfirmationEvent`

**Status.** WONT-FIX.

Legacy suppressed the next `beforeunload` prompt via this signal. v2 has no `beforeunload` handler (verified by grep across `src/`). Nothing to skip.

**Re-open if** a reload-confirmation feature is added to v2. Given the iframe context (parent controls iframe lifecycle, user rarely navigates the iframe directly), unlikely.

### G12 — `PageLockedEvent` / `PageUnlockedEvent` outgoing

**Status.** WONT-FIX.

Legacy fired these outgoing events when the editor's internal lock state changed (via `setLocked` or `setModifyAllowed` incoming). CS's parent-side listener used them to sync a mirrored `isPageLocked` field (`LiveEditPageProxy.ts:400–408`), read later in the customize-on-add flow (`LiveEditPageProxy.ts:471–475`).

v2 lock transitions are driven entirely by CS via `set-lock` / `set-modify-allowed` incoming. CS is the source of truth for lock state — no need for the iframe to echo state back to its own driver. CS's parent-side code tracks lock state directly from what it sent.

**Re-open if** the editor gains internal lock-state transitions (e.g. an auto-lock on idle) not originated by CS.

### G27 — `ShowWarningLiveEditEvent` outgoing

**Status.** WONT-FIX.

Legacy fired this to ask CS to display a toast-style warning banner in CS chrome. v2 displays drag/action warnings inline via `$dragState.message` and the drag placeholder UI (translated via `src/i18n/defaults.ts:38` and neighbors). Functionally equivalent for the warnings that exist; the toast UX is a CS-side stylistic choice.

**Re-open if** CS needs toast-style UI for non-drag warnings (e.g. a reset-on-empty-page notice surfaced from the editor). Adding `{type: 'warning'; message: string}` outgoing is trivial if needed later.

### G28 — Keyboard modifier event shape

**Status.** KEEP v2 SHAPE.

Legacy `editor-modifier-pressed` carried `{type, config: {bubbles, cancelable, ctrlKey, altKey, shiftKey, metaKey, keyCode, charCode}}` so CS could replay via `$(document).simulate(type, config)` (`LiveEditPageProxy.ts:172–176`).

v2 `keyboard-event` carries `{eventType, key, keyCode, modifiers: {ctrl, alt, shift, meta}}` — cleaner, typed, less duplication.

CS migration: translate once in the parent-side message handler:

```ts
// CS-side — small translation shim
if (msg.type === 'keyboard-event') {
  const config = {
    bubbles: true,
    cancelable: true,
    ctrlKey: msg.modifiers.ctrl,
    altKey: msg.modifiers.alt,
    shiftKey: msg.modifiers.shift,
    metaKey: msg.modifiers.meta,
    keyCode: msg.keyCode,
    charCode: 0,
  };
  $(document).simulate(msg.eventType, config);
}
```

Five lines of CS-side code; not worth matching legacy's shape.

---

## Implementation checklist

### Fixes

1. **G3** — `src/transport/adapter.ts:35–37` pass `silent` through; `src/state/selection.ts` accept an options arg or add a paired atom; `src/components/SelectionHighlighter.tsx` and any scroll logic skip on silent.
2. **G15** — `src/interaction/keyboard.ts` early-return branch for Delete/Backspace with selection → send `remove`.
3. **G20** — `src/interaction/navigation.ts` accepts `hostDomain`, implements `shouldIntercept` classifier, dev-warn on missing hostDomain with absolute URL skips.

### Verifications

4. **G16** — Playwright touch test for long-press context menu; fix if absent.
5. **G19** — manual test for scroll bleed-through on locked + tall page; fix if present (overscroll-behavior + wheel handler, or five-panel shader).

### Tests

6. `src/transport/adapter.test.ts` — select with `silent: true` doesn't trigger scroll/highlight observers.
7. `src/interaction/keyboard.test.ts` — Delete/Backspace with selection fires `remove`; with no selection, nothing; with modifier, forwards as keyboard-event.
8. `src/interaction/navigation.test.ts` — hostDomain-driven classification: internal relative, internal absolute, external absolute, same-page hash, download link, no-hostDomain fallback.

### CS migration notes

9. Stop firing `IframeBeforeContentSavedEvent` and `SkipLiveEditReloadConfirmationEvent` — no-op in v2.
10. Stop listening to `PageLockedEvent`/`PageUnlockedEvent` — track lock state parent-side from what CS sent.
11. Stop listening to `ShowWarningLiveEditEvent` — no v2 equivalent; convert any consumer code to read inline warnings instead.
12. Translate `keyboard-event` incoming into the legacy `simulate(type, config)` shape; keep existing jQuery simulate call.

---

## Tradeoffs captured

- **Four WONT-FIX closures are legitimate but CS-visible work** — CS has listeners and emitters for these legacy events; migration needs to prune them. Not hard, but non-zero effort.
- **G20's dev-warn on missing `hostDomain`** — some test environments might not pass hostDomain and trigger the warn. Gate with `process.env.NODE_ENV !== 'production'` or a library-level debug flag.
- **G15 swallowing Delete/Backspace** — removes the per-delete forwarding to CS's global keybinding. If any CS global keybinding listens to Delete on the iframe (unlikely — CS has its own tree-panel Delete handling), that's a regression. Mitigated by the "no modifier" gate — users who want to forward Delete can hold Ctrl.
- **G19 and G16 as verifications rather than fixes** — deliberate. Browsers do most of this work today; adding code speculatively is more likely to regress than fix.

---

## Cross-references

- Compatibility audit: `docs/compatibility.md`
- Init & lifecycle: `docs/gaps/01-INIT.md`
- Preview mode / options: `docs/gaps/02-PREVIEW-MODE.md` (hostDomain option)
- Load-component: `docs/gaps/03-LOAD-COMPONENT.md`
- Mutations: `docs/gaps/04-MUTATIONS.md` (isRoot helper)
- Palette drag: `docs/gaps/05-PALETTE-DRAG.md`
- Text updates: `docs/gaps/06-TEXT-UPDATE.md`
- Fragments: `docs/gaps/07-FRAGMENTS.md`
- Legacy bridge (for migration pruning): `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/LiveEditPageProxy.ts`
- v2 adapter: `src/transport/adapter.ts`
- v2 keyboard: `src/interaction/keyboard.ts`
- v2 navigation: `src/interaction/navigation.ts`
- v2 shader: `src/components/Shader.tsx`
- v2 selection: `src/interaction/selection.ts`, `src/components/SelectionHighlighter.tsx`
- v2 actions: `src/actions/resolve.ts`, `src/actions/definitions.ts`

<sub>*Drafted with AI assistance*</sub>
