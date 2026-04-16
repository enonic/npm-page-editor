import {ContextMenu} from '@enonic/ui';
import {useEffect} from 'preact/hooks';

import type {ComponentPath, PageConfig} from '../../src/main/resources/assets/js/v2/protocol';
import type {ComponentRecord} from '../../src/main/resources/assets/js/v2/state';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {ContextMenuItems} from '../../src/main/resources/assets/js/v2/components/ContextMenu';
import {$config, $dragState, setRegistry} from '../../src/main/resources/assets/js/v2/state';
import {setChannel} from '../../src/main/resources/assets/js/v2/transport';

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

const DEFAULT_CONFIG: PageConfig = {
  contentId: 'abc-123',
  pageName: 'My Page',
  pageIconClass: 'icon-page',
  locked: false,
  modifyPermissions: true,
  pageEmpty: false,
  pageTemplate: false,
  fragment: false,
  fragmentAllowed: true,
  resetEnabled: true,
  phrases: {},
};

function makeRecord(
  path: ComponentPath,
  type: ComponentRecord['type'],
  overrides?: Partial<ComponentRecord>,
): ComponentRecord {
  return {
    path,
    type,
    element: undefined,
    parentPath: undefined,
    children: [],
    empty: false,
    error: false,
    descriptor: undefined,
    fragmentContentId: undefined,
    loading: false,
    ...overrides,
  };
}

function resetStores(): void {
  $dragState.set(undefined);
  $config.set(undefined);
  setRegistry({});
}

type MenuSetupProps = {
  records: Record<string, ComponentRecord>;
  config?: Partial<PageConfig>;
  children: preact.ComponentChildren;
};

function MenuSetup({records, config, children}: MenuSetupProps): JSX.Element {
  $dragState.set(undefined);
  $config.set({...DEFAULT_CONFIG, ...config});
  setRegistry(records);
  setChannel(NOOP_CHANNEL);

  useEffect(() => resetStores, []);

  return <div className='pe-shell'>{children}</div>;
}

//
// * Trigger block
//

const TriggerBlock = (): JSX.Element => (
  <ContextMenu.Trigger asChild>
    <div className='flex cursor-default items-center justify-center rounded-lg border border-dashed border-bdr-soft p-12 text-sm text-subtle select-none'>
      Right-click to open context menu
    </div>
  </ContextMenu.Trigger>
);

//
// * Fixtures
//

const PART_PATH = '/main/0' as ComponentPath;
const PAGE_PATH = '/' as ComponentPath;
const REGION_PATH = '/main' as ComponentPath;
const LAYOUT_PATH = '/main/1' as ComponentPath;

//
// * Meta
//

const meta = {
  title: 'Page Editor v2/Context Menu',
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * Examples
//

export const PartComponent: Story = {
  name: 'Examples / Part',
  render: () => (
    <MenuSetup
      records={{
        [PAGE_PATH]: makeRecord(PAGE_PATH, 'page'),
        [REGION_PATH]: makeRecord(REGION_PATH, 'region', {parentPath: PAGE_PATH}),
        [PART_PATH]: makeRecord(PART_PATH, 'part', {parentPath: REGION_PATH}),
      }}
    >
      <ContextMenu>
        <TriggerBlock />
        <ContextMenu.Portal>
          <ContextMenu.Content>
            <ContextMenuItems path={PART_PATH} kind='component' />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu>
    </MenuSetup>
  ),
};

export const RegionActions: Story = {
  name: 'Examples / Region',
  render: () => (
    <MenuSetup
      records={{
        [PAGE_PATH]: makeRecord(PAGE_PATH, 'page'),
        [REGION_PATH]: makeRecord(REGION_PATH, 'region', {parentPath: PAGE_PATH}),
      }}
    >
      <ContextMenu>
        <TriggerBlock />
        <ContextMenu.Portal>
          <ContextMenu.Content>
            <ContextMenuItems path={REGION_PATH} kind='component' />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu>
    </MenuSetup>
  ),
};

export const PageActions: Story = {
  name: 'Examples / Page',
  render: () => (
    <MenuSetup
      records={{
        [PAGE_PATH]: makeRecord(PAGE_PATH, 'page'),
      }}
    >
      <ContextMenu>
        <TriggerBlock />
        <ContextMenu.Portal>
          <ContextMenu.Content>
            <ContextMenuItems path={PAGE_PATH} kind='component' />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu>
    </MenuSetup>
  ),
};

//
// * States
//

export const LockedPage: Story = {
  name: 'States / Locked Page',
  render: () => (
    <MenuSetup
      records={{
        [PAGE_PATH]: makeRecord(PAGE_PATH, 'page'),
      }}
    >
      <ContextMenu>
        <TriggerBlock />
        <ContextMenu.Portal>
          <ContextMenu.Content>
            <ContextMenuItems path={PAGE_PATH} kind='locked-page' />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu>
    </MenuSetup>
  ),
};

//
// * Features
//

export const MissingActions: Story = {
  name: 'Features / Missing Actions',
  render: () => (
    <MenuSetup
      records={{
        [PAGE_PATH]: makeRecord(PAGE_PATH, 'page'),
        [REGION_PATH]: makeRecord(REGION_PATH, 'region', {parentPath: PAGE_PATH}),
        [PART_PATH]: makeRecord(PART_PATH, 'part', {parentPath: REGION_PATH}),
      }}
      config={{fragmentAllowed: false}}
    >
      <ContextMenu>
        <TriggerBlock />
        <ContextMenu.Portal>
          <ContextMenu.Content>
            <ContextMenuItems path={PART_PATH} kind='component' />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu>
    </MenuSetup>
  ),
};

export const InsideLayout: Story = {
  name: 'Features / Inside Layout',
  render: () => {
    const nestedRegion = '/main/1/inner' as ComponentPath;
    const nestedPart = '/main/1/inner/0' as ComponentPath;

    return (
      <MenuSetup
        records={{
          [PAGE_PATH]: makeRecord(PAGE_PATH, 'page'),
          [REGION_PATH]: makeRecord(REGION_PATH, 'region', {parentPath: PAGE_PATH}),
          [LAYOUT_PATH]: makeRecord(LAYOUT_PATH, 'layout', {parentPath: REGION_PATH}),
          [nestedRegion]: makeRecord(nestedRegion, 'region', {parentPath: LAYOUT_PATH}),
          [nestedPart]: makeRecord(nestedPart, 'part', {parentPath: nestedRegion}),
        }}
      >
        <ContextMenu>
          <TriggerBlock />
          <ContextMenu.Portal>
            <ContextMenu.Content>
              <ContextMenuItems path={nestedPart} kind='component' />
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu>
      </MenuSetup>
    );
  },
};
