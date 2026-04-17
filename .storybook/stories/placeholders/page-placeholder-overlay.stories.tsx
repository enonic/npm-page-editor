import {useEffect} from 'preact/hooks';

import type {PageController} from '../../../src/protocol';
import type {ComponentRecord} from '../../../src/state';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {PagePlaceholderOverlay} from '../../../src/components/PagePlaceholderOverlay';
import {root} from '../../../src/protocol';
import {$modifyAllowed, $pageControllers, setRegistry} from '../../../src/state';
import {setChannel} from '../../../src/transport';

//
// * Helpers
//

function noop(): void {
  // no-op for story
}

const NOOP_CHANNEL = {
  send: noop,
  subscribe: () => noop,
  destroy: noop,
};

const SAMPLE_CONTROLLERS: PageController[] = [
  {descriptorKey: 'com.example:default', displayName: 'Default Controller', iconClass: 'icon-default'},
  {descriptorKey: 'com.example:landing', displayName: 'Landing Page', iconClass: 'icon-landing'},
  {descriptorKey: 'com.example:article', displayName: 'Article Layout', iconClass: 'icon-article'},
];

function emptyPageRecord(): Record<string, ComponentRecord> {
  const path = root();
  return {
    [path]: {
      path,
      type: 'page',
      element: undefined,
      parentPath: undefined,
      children: [],
      empty: true,
      error: false,
      descriptor: undefined,
      fragmentContentId: undefined,
      loading: false,
    },
  };
}

function resetStores(): void {
  $modifyAllowed.set(true);
  $pageControllers.set([]);
  setRegistry({});
}

type OverlaySetupProps = {
  controllers?: PageController[];
  children: preact.ComponentChildren;
};

function OverlaySetup({controllers = SAMPLE_CONTROLLERS, children}: OverlaySetupProps): JSX.Element {
  setRegistry(emptyPageRecord());
  $modifyAllowed.set(true);
  $pageControllers.set(controllers);
  setChannel(NOOP_CHANNEL);

  useEffect(() => resetStores, []);

  return <div className='pe-shell min-h-40'>{children}</div>;
}

//
// * Meta
//

const meta = {
  title: 'Placeholders/Page Placeholder Overlay',
  parameters: {layout: 'fullscreen'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * Examples
//

export const WithControllers: Story = {
  name: 'Examples / With Controllers',
  render: () => (
    <OverlaySetup>
      <PagePlaceholderOverlay />
    </OverlaySetup>
  ),
};

export const NoControllers: Story = {
  name: 'Examples / No Controllers',
  render: () => (
    <OverlaySetup controllers={[]}>
      <PagePlaceholderOverlay />
    </OverlaySetup>
  ),
};
