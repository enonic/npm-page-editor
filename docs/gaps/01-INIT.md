# 01 — Init & Lifecycle

Covers the initialization and lifecycle contract between Content Studio and the v2 page editor: what config goes over the wire, how idempotency is enforced, how errors are reported, and what "ready" means at each stage.

Scope: gaps **G2**, **G22**, **G13**, **G14** from `docs/compatibility.md`.

---

## G2 — `init` payload (PageConfig shape)

### Decision

**`PageConfig` adds zero fields.** It stays at 13:

```ts
export type PageConfig = {
  contentId: string;
  pageName: string;
  pageIconClass: string;
  locked: boolean;
  modifyPermissions: boolean;
  pageEmpty: boolean;
  pageTemplate: boolean;
  fragment: boolean;
  fragmentAllowed: boolean;
  resetEnabled: boolean;
  phrases: Record<string, string>;
  theme?: 'light' | 'dark';
  langDirection?: 'ltr' | 'rtl';
};
```

Every field legacy used to ship in `InitializeLiveEditEvent` has been verified — either redundant with an existing `PageConfig` field, derivable on the CS side and sent pre-resolved, or its only consumer was legacy iframe-side infrastructure that v2 has eliminated. See the field-by-field table below.

### `hostDomain` is NOT in PageConfig — it's a mount-time constructor option

Legacy used `UriHelper.setDomain(hostDomain)` at `.worktrees/master/src/main/resources/assets/js/page-editor/LiveEditPage.ts:140` for link-click classification inside the iframe. v2 needs the same value for gap G20 (navigation filtering).

But `hostDomain` is a **mount-time constant**, not page config — it's about *where the iframe is embedded*, which can never change for the iframe's JS lifetime. Every other `PageConfig` field can change at runtime (`locked`/`modifyPermissions` via dedicated messages; `contentId`/`pageName`/etc. via subsequent `init` messages). Stuffing `hostDomain` into the runtime config miscategorizes it.

Decision: `hostDomain` is passed to both entry points as a constructor option. See `docs/gaps/02-PREVIEW-MODE.md` for the full `EditorOptions` / `PreviewOptions` shape.

### Fields dropped from legacy's `InitializeLiveEditEvent`

Every field below is written by CS's `LiveEditPageProxy.ts:279–287` into `InitializeLiveEditEvent` today. We drop each with a specific "re-add if…" trigger so a future change re-opens the question on merit, not by accident.

| Legacy field | Why v2 doesn't need it | Re-add if… |
|---|---|---|
| `applicationKeys: string[]` | No v2 consumer; palette lives CS-side in the wizard chrome. Not read in legacy iframe code either. | v2 ships an in-iframe component palette that must filter by installed apps. |
| `language: string` | Legacy used at `TextComponentView.ts:137` for `Locale.supportsRtl(lang)` → derives `langDirection`. CS pre-computes `langDirection` and sends that directly. | v2 needs the raw locale for anything beyond direction (e.g. per-locale text rendering). |
| `contentType: string` | Legacy used at `PagePlaceholder.ts:66` for `type.isPageTemplate()`. CS pre-resolves to `pageTemplate: boolean` which PageConfig already has. For the content-type display name, CS pre-resolves and sends translated text via `phrases`. | v2 needs the raw type for classification beyond template / non-template. |
| `displayName: string` | Always equal to `pageName` — both set from `getContent().getDisplayName()` at `LiveEditParams.fromLiveEditModel:70,74`. Context-menu title uses the same value. | `pageName` and `displayName` diverge (unlikely in CS today). |
| `content: ContentSummaryAndCompareStatus` | Legacy used to feed `ContentContext` (`LiveEditPage.ts:149`) and `PageEditor.getContent()` public API. `ContentContext` boots lib-admin-ui iframe code v2 doesn't run. `getContent()` was used inside the iframe to build fetch URLs; v2 moved all URL construction to the CS parent side via `onComponentLoadRequest` callback. `contentId` is already in PageConfig. | v2 re-introduces in-iframe URL building or `getContent()` is revived. Covered by gap G21. |
| `user: PrincipalJson` + `principals: PrincipalJson[]` | Legacy called `AuthContext.init(user, principals)` at `LiveEditPage.ts:144`. `AuthContext` is lib-admin-ui and gates CS-side code paths v2 doesn't run. v2's permission surface is the `modifyPermissions` bool. | v2 introduces an iframe-side permission check that depends on role/principal identity rather than a single bool. |
| `projectJson: ProjectJson` | Legacy fed `ProjectContext` at `LiveEditPage.ts:146`. v2 has no iframe-side `ProjectContext` consumer. | v2 introduces project-aware behavior inside the iframe (e.g. project-specific placeholder copy). |
| `sitePath: string` | No consumer in either legacy iframe code or v2. Setter exists, no reader. | A real consumer shows up. |

### Implementation checklist

1. `PageConfig` in `src/protocol/messages.ts:12–26` — **no change**.
2. `hostDomain` handling is specified in `docs/gaps/02-PREVIEW-MODE.md` and implemented via constructor options on `initPageEditor` and `initPreview`.

---

## G22 — Idempotent init

### Decision

`initPageEditor` is idempotent: second call on the same module returns the existing instance and emits a `console.warn`. A successful `destroy()` clears the stored reference so a subsequent init starts fresh.

```ts
let currentInstance: PageEditorInstance | undefined;

export function initPageEditor(
  root: HTMLElement,
  target: Window,
  callbacks?: RendererCallbacks,
): PageEditorInstance {
  if (currentInstance != null) {
    console.warn('[page-editor] initPageEditor called while already initialized; returning existing instance.');
    return currentInstance;
  }

  // ... existing setup ...

  currentInstance = {destroy: wrappedDestroy, notifyComponentLoaded, notifyComponentLoadFailed, requestPageReload};
  return currentInstance;
}
```

`wrappedDestroy` calls the existing `destroy()` then `currentInstance = undefined`.

### Rationale

Legacy threw on second init (`PageEditor.ts:268`). Throwing is hostile for a library; silent double-mount (the current v2 behavior) is worse — it doubles every listener. Returning the existing instance is truly idempotent: callers can init defensively without wrapping in their own `if` check. The warning keeps accidental double-calls visible in dev.

### Known limitation

`currentInstance` is module-scoped, so **only one editor per JS context**. This is fine for the iframe use case (one iframe = one editor). If a future story needs two editors in the same page (unlikely — nested editors, Storybook multi-instance), switch to a `root`-keyed `Map<HTMLElement, PageEditorInstance>`.

---

## G13 — Init-error outgoing channel

### Decision

Add a new outgoing message:

```ts
| {type: 'error'; phase: 'init' | 'reconcile' | 'handle'; message: string}
```

No `stack` field. Production parent-side code doesn't need cross-iframe stack traces; devs can read the iframe console directly.

### Where it fires

Three phases map to the three sites where v2 can throw during normal operation:

| `phase` | Source | Trigger |
|---|---|---|
| `init` | `src/transport/adapter.ts` — `init`-message handler | Malformed `PageConfig` or a setter throws (e.g. invalid theme). |
| `reconcile` | `src/reconcile.tsx` — `reconcilePage()` | Parse failure on incoming `page-state`, broken descriptor tree, placeholder mount error. |
| `handle` | `src/transport/adapter.ts` — any other incoming-message handler | Any incoming message handler throws after init. |

Each site: wrap in try/catch → `channel.send({type: 'error', phase, message: err.message})` → log to console and re-throw or swallow per site policy (`reconcile` should not re-throw; `handle` can swallow since the message is already discarded on error).

Boot-time failures before the channel exists (e.g. `initPageEditor` throws mid-setup) are NOT covered — they propagate as thrown errors to the caller. CS handles that via normal try/catch around `initPageEditor`.

### CS-side consumer

Parent wires `window.addEventListener('message', ...)` handler to the existing editor-events bus; on `{type: 'error'}` it calls the modern equivalent of `PageEventsManager.notifyLiveEditPageInitializationError`.

---

## G14 — `ready` vs `page-ready`

### Decision

Keep `ready` (current semantic: "channel open, send me `init` and `page-state`"). Add a new outgoing message:

```ts
| {type: 'page-ready'}  // first successful page-state reconcile
```

### Two signals because there are two states

| Signal | Meaning | When CS should act |
|---|---|---|
| `ready` | Editor's transport, adapter, and overlay are mounted. Message queue is draining as soon as `init` arrives. | Dispatch `init` + `page-state`. |
| `page-ready` | First `page-state` has been reconciled; overlay reflects the page; user can interact. | Dismiss the loading spinner, reveal the iframe. This is the legacy `LiveEditPageViewReadyEvent` semantic. |

### Edge cases

- **Subsequent reconciles** — `page-ready` is one-shot per `PageEditorInstance`. A flag flips on first success; destroy/new-init resets.
- **Reconcile fails** — `{type: 'error', phase: 'reconcile', …}` fires (G13). `page-ready` does not. CS should prefer error handling; if a subsequent `page-state` succeeds, `page-ready` fires then.
- **"Not live-edit-allowed" case** — Legacy CS synthesized `LiveEditPageViewReadyEvent` parent-side at `LiveEditPageProxy.ts:294`. In v2, parent-side CS simply skips sending `init`/`page-state`; the iframe never emits `page-ready`; CS treats the absence as "editor has nothing to do" and moves on. No iframe-side change needed.

### Why not rename `ready` → `channel-ready`

The rename is breaking (tests, stories, CS migration branch, every doc reference), and produces two signals anyway — we'd just have different names. Additive is strictly safer.

### Implementation checklist

1. Add `page-ready` to `OutgoingMessage` in `src/protocol/messages.ts`.
2. In `src/reconcile.tsx`, on first successful `reconcilePage()` completion, call `getChannel()?.send({type: 'page-ready'})`. Use a module-level flag keyed by adapter lifetime.
3. Reset the flag when the channel resets (`resetChannel` call site in `src/init.tsx:127`).
4. Add test coverage in `src/init.test.tsx` and `src/reconcile.test.tsx`.

---

## Cross-references

- Compatibility audit: `docs/compatibility.md`
- Legacy init class: `.worktrees/master/src/main/resources/assets/js/page-editor/PageEditor.ts`
- Legacy tree builder: `.worktrees/master/src/main/resources/assets/js/page-editor/LiveEditPage.ts`
- CS bridge: `~/repo/app-contentstudio/modules/lib/src/main/resources/assets/js/app/wizard/page/LiveEditPageProxy.ts`
- v2 init: `src/init.tsx`
- v2 adapter: `src/transport/adapter.ts`
- v2 protocol: `src/protocol/messages.ts`

<sub>*Drafted with AI assistance*</sub>
