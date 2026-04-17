//
// * Default phrases — merged with server-provided phrases at lookup time.
// * Server values override these; missing keys fall back here.
//
// ! Invariant: every key used via `translate()` or `useI18n()` in v2 MUST
// ! have an entry here. Content Studio overrides defaults in production, but
// ! Storybook and unit tests run without that parent context — defaults are
// ! the only source of text there. Do not remove a key "because CS provides
// ! it" without first confirming no story/test relies on the fallback.
//

export const DEFAULT_PHRASES: Readonly<Record<string, string>> = {
  //
  // * Component type labels (match legacy `field.part|layout|fragment`)
  //
  'field.page': 'Page',
  'field.region': 'Region',
  'field.text': 'Text',
  'field.part': 'Part',
  'field.layout': 'Layout',
  'field.fragment': 'Fragment',

  //
  // * UI field labels
  //
  'field.pageController': 'Page controller',
  'field.pageController.empty': 'No controllers available',
  'field.pageController.placeholder': 'Choose a controller',

  //
  // * Drag/drop and placeholder messages
  //
  'field.region.empty': 'Drop components here...',
  'field.drag.release': 'Release here...',
  'field.drag.notAllowed': 'Cannot drop this component here.',
  'field.drag.self': 'Cannot drop a component inside itself.',
  'field.drag.layoutNested': 'Layouts cannot be nested inside other layouts.',
  'field.drag.fragmentLayout': 'This fragment contains a layout and cannot be placed inside another layout.',
  'field.drag.cellOccupied': 'This layout cell is already occupied.',

  //
  // * Error states
  //
  'field.component.renderError': 'This component could not be rendered.',

  //
  // * Action labels (menus/buttons)
  //
  'action.insert': 'Insert',
  'action.inspect': 'Inspect',
  'action.reset': 'Reset',
  'action.remove': 'Remove',
  'action.duplicate': 'Duplicate',
  'action.edit': 'Edit',
  'action.selectParent': 'Select Parent',
  'action.createFragment': 'Create Fragment',
  'action.detachFragment': 'Detach Fragment',
  'action.saveAsTemplate': 'Save as Template',
  'action.pageSettings': 'Page Settings',
};
