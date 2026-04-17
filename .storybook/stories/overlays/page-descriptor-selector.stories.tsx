import {useEffect} from 'preact/hooks';

import type {PageController} from '../../../src/main/resources/assets/js/v2/protocol';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {PageDescriptorSelector} from '../../../src/main/resources/assets/js/v2/components/PageDescriptorSelector';
import {$modifyAllowed, $pageControllers} from '../../../src/main/resources/assets/js/v2/state';
import {setChannel} from '../../../src/main/resources/assets/js/v2/transport';

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

function resetStores(): void {
  $modifyAllowed.set(true);
  $pageControllers.set([]);
}

type SelectorSetupProps = {
  controllers?: PageController[];
  modifyAllowed?: boolean;
  children: preact.ComponentChildren;
};

function SelectorSetup({
  controllers = SAMPLE_CONTROLLERS,
  modifyAllowed = true,
  children,
}: SelectorSetupProps): JSX.Element {
  $modifyAllowed.set(modifyAllowed);
  $pageControllers.set(controllers);
  setChannel(NOOP_CHANNEL);

  useEffect(() => resetStores, []);

  return <>{children}</>;
}

//
// * Meta
//

const meta = {
  title: 'Overlays/Page Descriptor Selector',
  parameters: {layout: 'centered'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * Examples
//

export const WithControllers: Story = {
  name: 'Examples / With Controllers',
  render: () => (
    <SelectorSetup>
      <PageDescriptorSelector />
    </SelectorSetup>
  ),
};

export const NoControllers: Story = {
  name: 'Examples / No Controllers',
  render: () => (
    <SelectorSetup controllers={[]}>
      <PageDescriptorSelector />
    </SelectorSetup>
  ),
};
