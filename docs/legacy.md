# Legacy Page Editor: Rendered Elements Reference

This document describes every rendered UI element in the legacy page editor
(`src/main/resources/assets/js/page-editor/`), how emptiness and errors are
determined, and how placeholders are toggled. The goal is to provide a
reference for the v2 migration.

## Class Hierarchy

```
Element (lib-admin-ui)
├─ ItemView
│  ├─ PageView
│  ├─ RegionView
│  └─ ComponentView
│     ├─ TextComponentView
│     ├─ ContentBasedComponentView
│     │  └─ FragmentComponentView
│     └─ DescriptorBasedComponentView
│        ├─ PartComponentView
│        └─ LayoutComponentView
├─ ItemViewPlaceholder (DivEl)
│  ├─ PagePlaceholder
│  ├─ RegionPlaceholder
│  ├─ TextPlaceholder
│  ├─ FragmentPlaceholder
│  └─ DescriptorBasedComponentViewPlaceholder (abstract)
│     ├─ PartPlaceholder
│     └─ LayoutPlaceholder
├─ Highlighter (SVG, RECTANGLE mode)
│  └─ SelectedHighlighter (SVG, CROSSHAIR mode)
├─ Shader (5 × DivEl)
├─ DragPlaceholder (extends ItemViewPlaceholder)
├─ PagePlaceholderInfoBlock (DivEl)
└─ Cursor (body cursor manager, not a rendered element)
```

## Views (DOM Wrappers with Behavior)

Views wrap server-rendered DOM elements. They don't create new visible DOM on
their own — they attach IDs, CSS classes, event listeners, context menus, and
placeholders to existing elements.

### ItemView (base)

File: `ItemView.ts`

Every view has:

- **placeholder** (`ItemViewPlaceholder`) — shown when `isEmpty()` or `hasRenderingError()`
- **contextMenu** (`ItemViewContextMenu`, from lib-contentstudio) — lazy-created on right-click
- **loadMask** (`LoadMask`, from lib-admin-ui) — loading spinner overlay (field exists, used for async operations)
- **`data-live-edit-type`** attribute set from `ItemType`
- **`data-live-edit-id`** attribute set from `ItemViewId`

Emptiness check:
```ts
isEmpty(): boolean {
    throw new Error('Must be implemented by inheritors');
}
```

Placeholder toggle logic:
```ts
refreshEmptyState(): ItemView {
    this.toggleClass('empty', this.isEmpty());
    this.togglePlaceholder();
    if (this.isSelected()) this.highlightSelected();
    return this;
}

isPlaceholderNeeded(): boolean {
    return this.isEmpty() || this.hasRenderingError();
}

hasRenderingError(): boolean {
    return this.getEl().getAttribute('data-portal-placeholder-error') === 'true';
}
```

When new-ui owns the `'placeholder'` feature, `togglePlaceholder()` always
removes the legacy placeholder (letting Preact handle it instead).

### PageView

File: `PageView.ts`, extends `ItemView`

- Uses `PagePlaceholder` as its placeholder
- `isEmpty()` → `this.getLiveEditParams().isPageEmpty` (server-decided)
- When locked: shows `Shader` over the entire page, creates a special
  `lockedContextMenu` with a single "Page Settings" action
- Parses child regions (`doParseItemViews`) or fragment components
  (`doParseFragmentItemViews`) depending on `isFragment` mode

### RegionView

File: `RegionView.ts`, extends `ItemView`

- Uses `RegionPlaceholder` as its placeholder
- `isEmpty()` → `componentViews.length === 0 || allComponentsAreMoving`
- Parses child component views from DOM (`doParseComponentViews`)
- Manages the "Reset" context menu action: adds it when non-empty, removes
  when empty

### ComponentView (abstract base for all components)

File: `ComponentView.ts`, extends `ItemView`

- `isEmpty()` → `this.empty` (set in constructor: `StringHelper.isEmpty(element.getHtml()) || (children.length === 1 && children[0] === placeholder)`)
- Context menu actions: Select Parent, Insert, Inspect, Reset, Remove, Duplicate, Create Fragment (conditional)
- `reset()` — clones the view from scratch, marking it as empty
- Keyboard bindings: `del` / `backspace` → remove component
- `refreshEmptyState()` hides/shows the Reset action based on emptiness

### DescriptorBasedComponentView (abstract)

File: `DescriptorBasedComponentView.ts`, extends `ComponentView`

Adds the **empty descriptor block** — shown when a component has a descriptor
selected but the server returned empty HTML:

```ts
refreshEmptyState(): this {
    super.refreshEmptyState();
    const hasDescriptor = !!component?.hasDescriptor();
    this.toggleClass('has-descriptor', hasDescriptor);

    if (this.isEmpty() && hasDescriptor) {
        this.showEmptyDescriptorBlock(component);
    } else {
        this.hideEmptyDescriptorBlock();
    }
    return this;
}
```

The empty descriptor block is a `DivEl` with class `empty-descriptor-block`,
appended **inside the placeholder**. Each subclass provides the text:

| View | Text |
|------|------|
| `PartComponentView` | `Part "{descriptorName}"` |
| `LayoutComponentView` | `Layout "{descriptorName}"` |

`descriptorName` is resolved as `component.getName()?.toString()` or falls
back to `component.getDescriptorKey().toString()`.

### ContentBasedComponentView (abstract)

File: `ContentBasedComponentView.ts`, extends `ComponentView`

Adds an "Edit" action to the context menu when non-empty. Fires
`EditContentFromComponentViewEvent` with the content ID resolved from
`liveEditParams.getFragmentIdByPath()`.

### TextComponentView

File: `text/TextComponentView.ts`, extends `ComponentView`

- Uses `TextPlaceholder` (icon: `icon-font-size`)
- `isEmpty()` → `StringHelper.isBlank(this.value)` (checks the text value, not DOM)
- Sets `dir` attribute for RTL languages
- Custom click handling with double-click detection (opens text editor via `EditTextComponentViewEvent`)
- "Edit" action in context menu when non-empty

### PartComponentView

File: `part/PartComponentView.ts`, extends `DescriptorBasedComponentView`

- Uses `PartPlaceholder` (icon: common `part` icon)
- Resets root `<a>` elements' `href` to `#` to prevent navigation
- Disables all links within the component
- `inspectActionRequired: true`

### LayoutComponentView

File: `layout/LayoutComponentView.ts`, extends `DescriptorBasedComponentView`

- Uses `LayoutPlaceholder` (icon: common `layout` icon)
- After construction, parses child regions (`doParseRegions`)
- Manages `RegionView` instances for nested regions
- `inspectActionRequired: true`

### FragmentComponentView

File: `fragment/FragmentComponentView.ts`, extends `ContentBasedComponentView`

- Uses `FragmentPlaceholder` (icon: `icon-pie`)
- Parses inner fragment components and strips `data-portal-component-type`
  attributes to prevent them from participating in drag-and-drop
- **Error handling**: propagates `data-portal-placeholder-error` from child
  elements up to the fragment root. When error is present, disables both
  the "Detach" and "Edit" actions
- "Detach Fragment" action in context menu when non-empty
- `inspectActionRequired: true`

## Placeholders

All placeholders extend `ItemViewPlaceholder` (which extends `DivEl`) and use
the CSS prefix `xp-page-editor-`.

### ItemViewPlaceholder (base)

File: `ItemViewPlaceholder.ts`

A `DivEl` with class `item-placeholder`. Has stub `select()`, `deselect()`,
and `focus()` methods for subclasses. Used as the base for all placeholder
types.

### PagePlaceholder

File: `PagePlaceholder.ts`

Rendered when the page has no controller set.

Structure:
```
div.item-placeholder.page-placeholder.icon-insert-template
└─ div.page-descriptor-placeholder
   ├─ PagePlaceholderInfoBlock (div.page-placeholder-info)
   │  ├─ div.page-placeholder-info-line1  (header text)
   │  └─ div.page-placeholder-info-line2  (description text)
   └─ PageDescriptorDropdown (from lib-contentstudio)
```

Text states:
- **Has controllers**: line1 = "Select a controller", line2 = "No templates found for {contentType}"
- **No controllers**: line1 = "No controllers", line2 = "Add applications"
- **Error**: line1 = custom message, line2 = custom description

The dropdown loads available page descriptors and fires
`SelectPageDescriptorEvent` on selection.

### RegionPlaceholder

File: `RegionPlaceholder.ts`

Structure:
```
div.item-placeholder.region-placeholder
└─ p  ("Drop components here..")
```

Shown when a region has no components or all components are being dragged.

### TextPlaceholder

File: `text/TextPlaceholder.ts`

Structure:
```
div.item-placeholder.text-placeholder.icon-font-size
```

Plain icon-only placeholder, no text content.

### PartPlaceholder

File: `part/PartPlaceholder.ts`

Structure:
```
div.item-placeholder.part-placeholder.{common-part-icon}
```

Plain icon-only placeholder, no text content. The empty descriptor block
(from `DescriptorBasedComponentView`) is appended inside when a descriptor is
set but rendering is empty.

### LayoutPlaceholder

File: `layout/LayoutPlaceholder.ts`

Structure:
```
div.item-placeholder.layout-placeholder.{common-layout-icon}
```

Same as PartPlaceholder — icon-only, empty descriptor block appended when
applicable.

### FragmentPlaceholder

File: `fragment/FragmentPlaceholder.ts`

Structure:
```
div.item-placeholder.fragment-placeholder.icon-pie
```

Icon-only placeholder.

### DragPlaceholder

File: `DragPlaceholder.ts`

Extends `ItemViewPlaceholder`, shown at the drop position during drag
operations. Contains a nested `DivEl` for the message display.

## Overlay Elements

### Highlighter

File: `Highlighter.ts`, extends `Element`

An SVG element appended to `<body>` with `pointer-events: none`. Contains:
- `<rect>` — bounding rectangle
- `<path>` — guide lines (used in CROSSHAIR mode)

Two modes via `HighlighterMode`:

| Mode | Usage | Behavior |
|------|-------|----------|
| `RECTANGLE` | Hover highlight | Sizes SVG to element dimensions, strokes the rect |
| `CROSSHAIR` | Selection highlight | Full-screen SVG with crossing lines + filled rect |

Default style:
```ts
stroke: 'rgba(0, 0, 0, 1)',
fill: 'transparent'
```

### SelectedHighlighter

File: `SelectedHighlighter.ts`, extends `Highlighter`

Singleton. Uses `CROSSHAIR` mode. Overrides style:
```ts
stroke: 'rgba(11, 104, 249, 1)',        // blue
fill: isEmptyView ? 'transparent' : 'rgba(90, 148, 238, .2)'
```

Empty views get transparent fill to avoid obscuring the placeholder.

### Shader

File: `Shader.ts`

Not an `Element` subclass — creates 5 `DivEl` elements directly:
- `page` — full-screen overlay (used when target is `PageView`)
- `north`, `east`, `south`, `west` — positioned around a target element

Behavior:
- `shade(element)` — positions the 4 directional shaders around the element,
  creating a "cut-out" effect. If the element is a `PageView`, uses the
  full-screen `page` shader instead
- Captures click, contextmenu, mouseenter, mouseleave, mousemove on all shaders
- Optionally disables scroll while shading

### Cursor

File: `Cursor.ts`

Not a rendered element. Singleton that manages `body` cursor style:
- `displayItemViewCursor(itemView)` — sets cursor from item type config
- `hide()` — sets `cursor: none`
- `reset()` — restores the original body cursor

## Error Detection

### Server-Side Error Attribute

The server sets `data-portal-placeholder-error="true"` on component elements
that failed to render. This is the primary error signal.

Detection in legacy `ItemView`:
```ts
hasRenderingError(): boolean {
    return this.getEl().getAttribute('data-portal-placeholder-error') === 'true';
}
```

Detection in v2 parse:
```ts
const ERROR_ATTR = 'data-portal-placeholder-error';
error: element.getAttribute(ERROR_ATTR) === 'true',
```

### Fragment Error Propagation

`FragmentComponentView` walks its child DOM, stripping `data-portal-component-type`
attributes. During this walk, if any child has `data-portal-placeholder-error`,
the attribute is copied to the fragment root element:

```ts
const hasErrors = !!htmlElement.getAttribute('data-portal-placeholder-error');
if (hasErrors) {
    this.getEl().setAttribute('data-portal-placeholder-error', 'true');
}
```

When the fragment has errors:
- `detachAction.setEnabled(false)` — can't detach a broken fragment
- `editAction.setEnabled(false)` — can't edit a broken fragment

### Effect on Placeholder Visibility

`isPlaceholderNeeded()` returns `true` for **both** empty and error states:
```ts
isPlaceholderNeeded(): boolean {
    return this.isEmpty() || this.hasRenderingError();
}
```

This means a component with rendering errors shows its placeholder even if
the element technically has content (the error content from the server).

## Emptiness Detection

### Per-View Type

| View | `isEmpty()` Logic |
|------|-------------------|
| `PageView` | `liveEditParams.isPageEmpty` (server-decided flag) |
| `RegionView` | `componentViews.length === 0 \|\| allComponentsMoving` |
| `ComponentView` | `StringHelper.isEmpty(element.getHtml()) \|\| (children === [placeholder])` |
| `TextComponentView` | `StringHelper.isBlank(this.value)` (checks stored text value) |

### Empty + Has Descriptor (Non-Rendering Components)

This is a special state unique to `DescriptorBasedComponentView` (parts and
layouts). It occurs when:

1. A descriptor (controller) is selected for the component (`hasDescriptor() === true`)
2. The server returned empty HTML for the component (`isEmpty() === true`)
3. No rendering error occurred

In this state, the component shows:
- The type-specific placeholder (icon)
- An `empty-descriptor-block` DivEl appended inside the placeholder
- Text: `{Type} "{descriptorName}"` (e.g., `Part "com.example.my-part"`)

This distinguishes between "no descriptor selected" (just the icon placeholder)
and "descriptor selected but nothing rendered" (icon + descriptor name label).

### Empty State Effects

When `isEmpty()` is `true`:
- CSS class `empty` is toggled on the element
- Placeholder is appended to the DOM
- Reset action is hidden (nothing to reset)
- On selection: `placeholder.select()` and `placeholder.focus()` are called
- Context menu positioning adjusts to not overlay the empty view
- SelectedHighlighter uses transparent fill (no blue tint)

## Context Menu Actions by View Type

| View Type | Actions |
|-----------|---------|
| **PageView** | Inspect, Reset (disabled if `!isResetEnabled`), Save as Template |
| **PageView (locked)** | Page Settings (single action) |
| **RegionView** | Select Parent, Insert, Reset (only when non-empty) |
| **ComponentView** (base) | Select Parent, Insert, Inspect*, Reset, Remove, Duplicate, Create Fragment* |
| **TextComponentView** | + Edit (when non-empty) |
| **FragmentComponentView** | + Edit (when non-empty), + Detach Fragment (when non-empty) |

\* Inspect is conditional on `inspectActionRequired`. Create Fragment is
conditional on `isFragmentAllowed` and component not being a fragment itself.

Top fragment components (parent is `PageView` in fragment mode) omit: Select
Parent, Insert, Remove, Duplicate, Create Fragment.
