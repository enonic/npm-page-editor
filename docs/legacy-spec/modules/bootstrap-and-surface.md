# Module: bootstrap-and-surface

**Files:** `page-editor/PageEditor.ts`, `page-editor/index.ts`, `page-editor/event/EditorEvent.ts`
**LOC:** ~387
**Role:** Static entry point. Installs jQuery globals, registers ~30 event classes on the iframe bus, attaches global keyboard and link-click listeners, optionally constructs `LiveEditPage` in edit mode, and exposes the npm API.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Public Surface](#public-surface)
3. [npm Event Semantics](#npm-event-semantics)
4. [Init Sequence](#init-sequence)
5. [Global Listeners](#global-listeners)
6. [Iframe-Bus Class Registration](#iframe-bus-class-registration)
7. [Flag and Branch Audit](#flag-and-branch-audit)
8. [Error Surfaces](#error-surfaces)
9. [Lifecycle Contract for Consumers](#lifecycle-contract-for-consumers)
10. [Suspicious Conditions](#suspicious-conditions)

---

## Purpose

Single entry point of the legacy in-iframe page editor. Boots the editor inside the preview iframe, wires jQuery + jQuery-UI + jquery-simulate into the global environment, sets up the iframe-bus so ~30 event classes can serialize across the iframe boundary to the parent wizard, installs global `document` / `window` listeners that translate browser input into bus events, optionally constructs `LiveEditPage` in edit mode, and exposes a tiny static npm API. See `index.ts:1-26`, `PageEditor.ts:1-333`, `EditorEvent.ts:1-28`.

---

## Public Surface

### Exports

- `PageEditor` (class, static-only) — `index.ts:1`
- `EditorEvents` (string enum) — `index.ts:2`, defined `EditorEvent.ts:3-8`
- `EditorEvent<D>` (generic wrapper extending `Event`) — `EditorEvent.ts:10-28`
- Re-exports of view/item-type/factory classes — `index.ts:4-22`
- Re-export `Element`, `NewElementBuilder` from `@enonic/lib-admin-ui` — `index.ts:25`
- Re-export `ComponentPath` from `@enonic/lib-contentstudio` — `index.ts:26`

### `PageEditor` static members

| Member | Signature | File:Line |
|--------|-----------|-----------|
| `init(editMode: boolean)` | single-shot; throws if already initialized | `PageEditor.ts:262-275` |
| `isInitialized(): boolean` | truthiness check on `mode` | `:277-279` |
| `getContent(): ContentSummaryAndCompareStatus \| undefined` | delegates to `liveEditPage?.getContent()` | `:281-283` |
| `on(EditorEvents, handler)` | thin `Event.bind` | `:285-287` |
| `un(EditorEvents, handler)` | thin `Event.unbind` | `:289-291` |
| `notify(event, data?)` | overloaded; translates `EditorEvents` → internal iframe-bus event | `:293-317` |

### `EditorEvents` literal values

- `ComponentLoadRequest = 'component:load:request'`
- `PageReloadRequest = 'page:reload:request'`
- `ComponentLoadFailed = 'component:load:failed'`
- `ComponentLoaded = 'component:loaded'`

### `EditorEvent<D>`

- `constructor(type: EditorEvents, data?: D)`
- `setData(data) → this`
- `getData(): D | undefined`

---

## npm Event Semantics

Each of the four events has one well-defined direction and meaning:

- **`ComponentLoadRequest`** — editor asks the npm consumer to fetch and re-mount a component's HTML. Fired by `LiveEditPage` on receiving `LoadComponentViewEvent`. Consumer MUST respond with `ComponentLoaded` or `ComponentLoadFailed`. Not a valid `notify` argument (consumer-inbound only).
- **`ComponentLoaded`** — consumer signals success `{path}`; `notify` fires `ComponentLoadedEvent(path)` on the iframe bus which triggers sortable refresh (`PageEditor.ts:300-306`).
- **`ComponentLoadFailed`** — consumer signals failure `{path, reason}`; `notify` fires `LoadComponentFailedEvent(path, reason)` on the bus (`PageEditor.ts:307-313`).
- **`PageReloadRequest`** — consumer asks the host to reload the whole page; `notify` fires `PageReloadRequestedEvent()` on the bus (`PageEditor.ts:298-299`).

---

## Init Sequence

`PageEditor.init(editMode)` at `PageEditor.ts:262-275`:

1. If `this.mode` is already set → throw `Error('Page editor is already initialized in "<mode>" mode.')`.
2. Assign mode: `RenderingMode.EDIT` if `editMode` is true, else `RenderingMode.INLINE`.
3. `initializeGlobalState()`: publish jQuery into `Store.instance()` as `'$'`; set `StyleHelper` current prefix to `ItemViewPlaceholder.PAGE_EDITOR_PREFIX`.
4. `initializeEventBus()`: register 30+ classes on the iframe bus (`PageEditor.ts:199-243`).
5. `initListeners(editMode)`: install global listeners.
6. If `editMode` → `this.liveEditPage = new LiveEditPage()`.

No teardown or dispose API exists. The module is assumed to live for the iframe's entire lifetime.

---

## Global Listeners

Installed in `initListeners(editMode)` (`PageEditor.ts:319-332`); each slot guarded with `!= null`:

- **`document` `keypress keydown keyup` — edit-mode only** (`PageEditor.ts:320-323`). Handler `createDocumentKeyListener()` (`:126-147`): if `shouldBubbleEvent(event)` (F2 OR modifier+key), builds an `IframeEvent('editor-modifier-pressed')` with payload `{ type, config: {bubbles, cancelable, ctrlKey, altKey, shiftKey, metaKey, keyCode, charCode} }` and fires on the iframe bus. Also calls `preventDefault()` when the key matches a parent-registered `KeyBinding` (via `Store.parentInstance().get(KEY_BINDINGS_KEY)`).
- **`window` `load` — edit-mode only** (`PageEditor.ts:324-327`). Fires `IframeEvent('editor-iframe-loaded')`.
- **`window` `click` — always installed** (`PageEditor.ts:328-331`). Walks up from `event.target` looking for an `<a>`, extracts `data-content-path` or `href`, and if the link is an in-XP cross-page navigation fires `ContentPreviewPathChangedEvent(path)`.

---

## Iframe-Bus Class Registration

`IframeEventBus.get()` calls `addReceiver(parent).setId('iframe-bus')`. Every class must be `registerClass('Name', Ctor)` on both peers for serialization to survive the iframe boundary. Grouped behaviorally (`PageEditor.ts:199-243`):

- **Shared DTO / value-object types** (`:204-219`) — ContentSummaryAndCompareStatus, ContentSummary, ContentPath, ContentName, ContentTypeName, ApplicationKey, PrincipalKey, IdProviderKey, ContentId, ChildOrder, FieldOrderExpr, Workflow, ComponentPath, PartComponentType, LayoutComponentType, FragmentComponentType, TextComponentType (last at `:239`). These are payload types that must round-trip, not events.
- **Incoming (wizard → iframe)** (`:221-229, 234-238`) — AddComponentViewEvent, MoveComponentViewEvent, RemoveComponentViewEvent, SelectComponentViewEvent, DeselectComponentViewEvent, DuplicateComponentViewEvent, LoadComponentViewEvent, ResetComponentViewEvent, UpdateTextComponentViewEvent, PageStateEvent, SetPageLockStateEvent, CreateOrDestroyDraggableEvent, SetDraggableVisibleEvent, InitializeLiveEditEvent, LiveEditParams. Handlers live in `LiveEditPage`.
- **Outgoing** — `PageReloadRequestedEvent`, `ComponentLoadedEvent`, `LoadComponentFailedEvent` are fired from `notify` (`:299,306,313`). `IframeBeforeContentSavedEvent` at `:236` is an outgoing "about to save" trigger. `MinimizeWizardPanelEvent` at `:240` and `SkipLiveEditReloadConfirmationEvent` at `:231` are wizard-side outgoing signals.

---

## Flag and Branch Audit

- `editMode=true`: installs doc-key + window-load listeners AND constructs `LiveEditPage` (edit chrome).
- `editMode=false`: only window-click listener installed; `liveEditPage` stays null so `getContent()` returns `undefined`; iframe still forwards link navigations to parent.

`shouldBubbleEvent` (`PageEditor.ts:67-74`): keyCode 113 (F2) always bubbles; otherwise requires modifier+key.

`hasMatchingBinding` (`PageEditor.ts:84-103`) per combination:
- `'backspace'` → keyCode 8
- `'del'` → keyCode 46 (FALLS THROUGH to `'mod+del'` — bug: plain Delete never matches)
- `'mod+s'` → keyCode 83 + modifier
- `'mod+esc'` → keyCode 83 + modifier (copy-paste typo; matches Mod+S, not Mod+Esc)
- `'mod+alt+f4'` → keyCode 115 + modifier + alt

`notify` branches (`PageEditor.ts:296-317`):
- `PageReloadRequest` → fires `PageReloadRequestedEvent()` (no validation)
- `ComponentLoaded` → requires `{path}`, else throws
- `ComponentLoadFailed` → requires `{path, reason}`, else throws
- Any other value → throws `"unsupported event name"`. `ComponentLoadRequest` is deliberately NOT a `notify` argument.

---

## Error Surfaces

- `init` throws on re-init (`PageEditor.ts:264`).
- `notify` throws on missing `path` / `reason` (`:303, 310`) or unknown event name (`:315`).
- `stopBrowserShortcuts` logs `'Prevented default for event in live edit because it has binding in parent'` on match (`:122`).
- `getContent` silently returns `undefined` before init or in inline mode.

---

## Lifecycle Contract for Consumers

1. Import the package (jQuery/jQuery-UI/jquery-simulate installed as side-effects).
2. Call `PageEditor.init(editMode)` once.
3. `getContent()` is meaningful only after `init(true)` AND after `LiveEditPage` has received `InitializeLiveEditEvent`.
4. `on/un` are safe to call at any time.
5. `notify` requires `init` first (it dereferences `iframeEventBus`).
6. No teardown.

---

## Suspicious Conditions

- `PageEditor.ts:88-92` — `case 'del'` fall-through means plain Delete never matches the `'del'` binding.
- `PageEditor.ts:97-99` — `case 'mod+esc'` uses keyCode 83 (S); this is a copy-paste typo.
- `PageEditor.ts:328` — window click listener is installed in inline mode too; fires `ContentPreviewPathChangedEvent` silently even when the editor isn't in edit mode.
- `PageEditor.ts:319-332` — per-slot `!= null` guards are redundant given the outer single-shot init guard.
