# Page Editor Preact Migration Notes

## What is fragile in the current setup

The current page editor bundle is still built around:

- legacy `Element` subclasses and jQuery-driven DOM mutation
- one global LESS entrypoint at [`src/main/resources/assets/css/main.less`](./../src/main/resources/assets/css/main.less)
- shared admin/content-studio styles imported directly into the same CSS bundle

That model is workable for the legacy editor, but it makes styling fragile inside the live page iframe:

- the editor markup is rendered on top of real site markup, so the site can still affect the editor chrome through element selectors and inherited typography
- the editor can only defend itself with class prefixes, not with a real isolation boundary
- introducing `@enonic/ui` or Tailwind globally would be risky because resets, utilities, and tokens would leak into the page under edit
- there is no component-level rendering lab for checking empty, error, locked, or grouped layout states outside the full runtime

## Why a direct CSS import is not the answer

`lib-admin-ui` already uses Preact as a peer and newer UI surfaces are moving toward `@enonic/ui`, but importing `@enonic/ui` styles into the existing page-editor bundle would still be the wrong move for this package.

`@enonic/ui` ships a Tailwind-based style layer. If that layer is injected globally into the edited page iframe, it can:

- reset HTML element defaults inside the customer page
- introduce utility classes and CSS variables into the edited content
- create hard-to-debug conflicts between editor chrome and site styles

The page editor needs a style boundary first, not more global CSS.

## Recommended migration shape

### Phase 1

Build new editor chrome as isolated Preact surfaces:

- page placeholder
- region placeholder
- empty/error component cards
- inspection-side surfaces that do not own drag/drop behavior

Render those surfaces through a shadow-root host so Tailwind stays inside the component boundary.

### Phase 2

Keep the legacy runtime logic while swapping presentation shells:

- drag/drop remains in legacy `ItemView` / `RegionView` / `ComponentView`
- event bus and content-studio integration remain unchanged
- only visual wrappers move first

This reduces migration risk and keeps behavioral regressions localized.

### Phase 3

After the isolated shells are stable, migrate composite editor areas:

- grouped region layouts
- locked state overlays
- placeholder menus and descriptor pickers

Only then move deeper interaction-heavy pieces.

## Testing strategy

Use three layers of visual validation.

### 1. Separate stories

Each state gets its own story:

- empty page placeholder
- empty region placeholder
- empty component
- populated component
- rendering error
- locked state

### 2. Grouped stories

Compose multiple states together:

- two-column layout with mixed healthy and broken components
- nested regions
- empty slot plus real components
- inspector rail plus canvas

These grouped stories catch spacing, overflow, and alignment issues that isolated stories miss.

### 3. Runtime verification

After a surface is migrated, verify it in the live editor against:

- a page with aggressive global site CSS
- narrow and wide viewports
- long titles and long placeholder text
- empty, selected, dragging, and error states

## What was added here

This repo now includes:

- Storybook scaffolding in [`.storybook/main.ts`](./../.storybook/main.ts)
- an isolated shadow-root rendering host in [`.storybook/page-editor/shadow-host.tsx`](./../.storybook/page-editor/shadow-host.tsx)
- Tailwind-based visual stories for separate and grouped editor states in [`.storybook/page-editor/page-editor.stories.tsx`](./../.storybook/page-editor/page-editor.stories.tsx)

The stories are not a runtime migration by themselves. They are the safe proving ground needed before replacing the current live editor DOM.
