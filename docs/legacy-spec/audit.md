# Audit Findings

**Reviewed:** 10 logical modules + cross-module contract analysis
**Note:** No formal automated audit pass was executed. This file consolidates suspicious conditions, known bugs, behavioral gaps, and contract drifts extracted during module analysis and contract resolution. All findings are traceable to upstream module analysis.

**Summary:** 7 Critical, 14 Warning, 9 Note

---

## Critical (7)

These findings would cause incorrect behavior in a reimplementation if left unaddressed, or represent bugs that produce wrong runtime behavior today.

---

**1. Inverted deselect guard** — inbound-router (LiveEditPage)
- File: `LiveEditPage.ts:285`
- Code: `if (itemView && !itemView.isSelected()) { itemView.deselect(true); }`
- Impact: Path-based `DeselectComponentViewEvent` is a no-op for the actually-selected item. Any view that IS selected is never deselected by this handler; only unselected views are targeted. Wizard-driven deselect of a specific component does nothing.

**2. Pre-try-catch rehydration failure silently kills init** — inbound-router (LiveEditPage)
- File: `LiveEditPage.ts:137-152`
- Evidence: JSON parsing of `phrasesAsJson`, `Principal.fromJson`, `Project.fromJson`, and `PageBuilder().fromJson(...).build()` all run BEFORE the try block that fires `LiveEditPageInitializationErrorEvent`.
- Impact: Any malformed init payload throws unhandled out of the event handler; the wizard never receives an init-error event and will wait indefinitely for `LiveEditPageViewReadyEvent`.

**3. `droppedListeners` never invoked** — drag-and-drop (DragAndDrop)
- File: `DragAndDrop.ts:66, 516-523`
- Evidence: `notifyDropped` fires the class event but does not iterate `droppedListeners` array. `onDropped(cb)` subscribers never receive callbacks.
- Impact: Any code registering `DragAndDrop.onDropped` expects a callback that never arrives.

**4. `ComponentViewDragCanceledEvent` carries full view object** — drag-and-drop (DragAndDrop)
- File: `DragAndDrop.ts:553`
- Evidence: `ComponentViewDragCanceledEvent(componentView)` passes the full `ComponentView` object; all sibling lifecycle events pass `ComponentPath`.
- Impact: `ComponentView` is not registered via `registerClass` on the bus. Cross-iframe serialization of this event may crash. Consumer contract is inconsistent with all other drag lifecycle events.

**5. `SetModifyAllowedEvent` missing from bus registration** — bootstrap-and-surface + inbound-router
- File: `PageEditor.ts:221-240` (omission); `LiveEditPage.ts:408-412` (listener exists)
- Evidence: The handler for `SetModifyAllowedEvent` is subscribed in `LiveEditPage`, but the class is never registered via `IframeEventBus.registerClass`. For cross-iframe serialization to work, both peers must register the class.
- Impact: If the wizard fires `SetModifyAllowedEvent`, it may fail to deserialize on the iframe side; modify-permissions may silently never arrive.

**6. `remove()` does not deselect** — view-base (ItemView)
- File: `ItemView.ts:445-464`
- Evidence: `ItemView.remove()` skips `deselect()` and `unhighlightSelected()`. `DeselectComponentEvent` is NOT emitted on removal.
- Impact: Direct `view.remove()` on a selected view leaves wizard selection stale and keeps `SelectedHighlighter` referencing a detached view. `LiveEditPage` pre-deselects before `RemoveComponentViewEvent`, so that path works; but any code calling `remove()` directly (e.g. internal teardown) produces stale state.

**7. Template bug in draggable proxy helper** — inbound-router (LiveEditPage)
- File: `LiveEditPage.ts:419`
- Evidence: `` `<div id="${idAttr}" ${dataAttr}}>` `` — extra `}` in the template string produces malformed HTML.
- Impact: The hidden helper `<div>` may not be created correctly, breaking palette-drag proxy. Reimplementation must render `<div id="drag-helper-<type>" data-portal-component-type="<type>"></div>` without the stray brace.

---

## Warning (14)

These findings represent behavioral edge cases, subscription leaks, or design decisions that are likely to cause bugs in specific browser environments or session states.

---

**1. `ComponentLoadedEvent` subscription never unregistered** — inbound-router (LiveEditPage)
- File: `LiveEditPage.ts:238` registered; missing from `unregisterGlobalListeners`
- Impact: Subscription leak on destroy; closure holds reference to `pageView` preventing GC.

**2. `SetDraggableVisibleEvent` subscription never unregistered** — inbound-router (LiveEditPage)
- File: `LiveEditPage.ts:448` registered; missing from `unregisterGlobalListeners`
- Impact: Same leak pattern as above.

**3. Double drag lifecycle events on Chromium palette drags** — drag-and-drop (DragAndDrop)
- File: `DragAndDrop.ts:189` (draggable) and `:252` (sortable)
- Evidence: Both draggable `start` and sortable `start` fire `notifyDragStarted`. On Chromium, both fire per palette drag; on Firefox only one fires. Consumers of `ComponentViewDragStartedEvent` / `ComponentViewDragStoppedEvent` may receive two events with different payloads (`undefined` vs actual path).
- Impact: Consumers must implement deduplication logic.

**4. Self-move not suppressed** — drag-and-drop (DragAndDrop)
- File: `DragAndDrop.ts:306`
- Impact: Dropping a component at its original position fires `MoveComponentEvent(from, to)` with equal paths. Wizard must handle self-move as a no-op.

**5. `replaceWith` page-root fragment skips `notifyItemViewAdded`** — component-view-base (ComponentView)
- File: `ComponentView.ts:335` vs `:328-329`
- Impact: Consumers listening for `ItemViewAddedEvent` to rebuild secondary indices miss fragment-root replacements. Must use `ComponentLoadedEvent` instead for that case.

**6. `setModifyPermissions(true)` does NOT auto-unlock** — page-view (PageView)
- File: `PageView.ts:139-145` + `:121-124`
- Impact: Downstream must not assume that granting modify permission restores edit mode. Only an explicit `setLocked(false)` (via `SetPageLockStateEvent`) restores edit mode.

**7. Unlock fires two outgoing events** — page-view (PageView)
- File: `PageView.ts:335` (`PageUnlockedEvent`) + `:336` (`ComponentInspectedEvent(root)`)
- Impact: Consumers receiving `ComponentInspectedEvent` must handle it being fired automatically on unlock (not just explicit user inspect).

**8. Auto-created text fires `rightClicked: true`** — page-view (PageView)
- File: `PageView.ts:188`
- Evidence: `SelectComponentEvent` for newly-auto-created text views hard-codes `rightClicked: true`.
- Impact: Consumers gating inspector panel or context panel on `rightClicked` will incorrectly treat auto-created text as right-clicked.

**9. `Shader.ts:90` — classname check breaks under minification**
- File: `Shader.ts:90`
- Evidence: `ClassHelper.getClassName(element) === 'PageView'` uses a string literal class name that would not survive minification.
- Impact: Full-page shader mode would silently fall back to element-mode on minified builds.

**10. `isElementOverRegion` null guard missing** — region-view (RegionView)
- File: `RegionView.ts:182-184`
- Evidence: Walks `parentElement` without a null guard.
- Impact: During drag, stray mouseover on editor chrome (which is not under a region) could throw TypeError.

**11. skip-confirmation unload flag is dead code** — inbound-router (LiveEditPage)
- File: `LiveEditPage.ts:217-223`
- Evidence: Both branches of the unload handler converge on `pageView.remove()`; the flag only self-clears.
- Impact: No observable effect; `SkipLiveEditReloadConfirmationEvent` does nothing today.

**12. `componentAddedListener` / `componentRemovedListener` never attached in RegionView** — region-view (RegionView)
- File: `RegionView.ts:141-157`
- Evidence: Defined but no bind site within this module.
- Impact: Without external wiring, placeholder and reset-menu state can desync with model component mutations.

**13. Re-init unsafe in LiveEditPage** — inbound-router (LiveEditPage)
- File: `LiveEditPage.ts` — no double-init guard
- Impact: If `InitializeLiveEditEvent` fires twice (e.g. after error recovery), listeners are double-subscribed, `Messages.addMessages` accumulates, and state is corrupted.

**14. Phantom-click suppression applies after canceled drops** — drag-and-drop (DragAndDrop)
- File: `DragAndDrop.ts:327-332`
- Evidence: `newlyDropped=true` set in both allowed AND forbidden/canceled branches.
- Impact: After a canceled drop, the next click within 100ms is suppressed even though no component was actually dropped.

---

## Note (9)

Minor issues, code quality concerns, or design asymmetries that are non-breaking but should be addressed in a reimplementation.

---

**1. Key-binding `'del'` case fall-through** — bootstrap-and-surface (PageEditor)
- File: `PageEditor.ts:88-92`
- Evidence: `case 'del'` falls through to `'mod+del'`, meaning plain Delete never matches the `'del'` binding.

**2. Key-binding `'mod+esc'` uses wrong keyCode** — bootstrap-and-surface (PageEditor)
- File: `PageEditor.ts:97-99`
- Evidence: Uses keyCode 83 (the letter S); this matches `Mod+S`, not `Mod+Esc`. Copy-paste error.

**3. Window click listener active in inline mode** — bootstrap-and-surface (PageEditor)
- File: `PageEditor.ts:328`
- Evidence: The `window` click listener that fires `ContentPreviewPathChangedEvent` is installed regardless of `editMode`.
- Impact: In inline/preview mode, internal link clicks still fire events to parent.

**4. `shaded` field is write-only dead state** — view-base (ItemView)
- File: `ItemView.ts:152, 428, 433`
- Evidence: Written in several places, never read.

**5. `DragPlaceholder.regionView` is write-only dead state** — drag-and-drop (DragAndDrop)
- File: `DragPlaceholder.ts:83`
- Evidence: `this.regionView = regionView` assigned but field never read.

**6. `isRendered()` hardcoded true in PageView** — page-view (PageView)
- File: `PageView.ts:641-643`
- Evidence: Returns `true` unconditionally, bypassing normal lifecycle check.

**7. `Cursor.defaultBodyCursor` captured too early** — overlay-chrome (Cursor)
- File: `Cursor.ts:14`
- Evidence: Cached at first `Cursor.get()`. If the page cursor was changed before first get, `reset()` restores the wrong cursor.

**8. Fragment-mode inserts empty DivEl at index 0** — page-view (PageView)
- File: `PageView.ts:560-562`
- Evidence: An empty `DivEl` is inserted as child 0 before fragment parse, shifting all DOM children.
- Impact: Any code assuming fragment-mode body structure must account for this extra node.

**9. `ContentBasedComponentView` Edit action frozen at construction** — component-view-base
- File: `ContentBasedComponentView.ts:19-23`
- Evidence: Edit action is added to the context menu only when `!isEmpty()` at construction time. A fragment that becomes non-empty after construction never gets the edit action.

---

## What the Spec Got Right

The upstream analysis produced clear, concrete coverage of:

- The full 18-event inbound routing table with exact handler behaviors.
- The bubble-through hover algorithm (novel, non-obvious, correctly specified).
- The handleClick 6-branch decision tree and its guard ordering.
- The palette-drag proxy mechanism (the `CreateOrDestroyDraggableEvent` trick) — particularly well documented with the rationale for why a hidden DOM element + simulated events is needed.
- The component-load round-trip (4-step: LoadComponentViewEvent → ComponentLoadRequest npm event → consumer fetches → ComponentLoaded ack → sortable refresh).
- The selection persistence mechanism (IframeBeforeContentSavedEvent write / restoreSelection read).
- The parse-and-registry build order and the three parse loops.
- Fragment-mode vs page-mode dual rendering in PageView.
- Drop rule invariants (no nested layouts, no fragment-with-layout in layouts).
- The full DOM attribute contract.

## Missing Coverage

- External event class source (defined in `@enonic/lib-contentstudio` and `@enonic/lib-admin-ui`): payload shapes inferred from call-site getters only, not from source of truth.
- npm consumer behavior (`app-contentstudio`'s `EditorEventHandler.ts`): referenced for behavioral context but not analyzed.
- CSS and stylesheets under `assets/css/`: outside the subject, not covered.
- No formal automated audit pass was run; the above list is based on static analysis observations from module reviewers.
