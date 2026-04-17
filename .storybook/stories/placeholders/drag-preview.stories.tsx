import {useEffect} from 'preact/hooks';

import type {ComponentPath} from '../../../src/protocol';
import type {DragState} from '../../../src/state';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {DragPreview} from '../../../src/components/DragPreview';
import {fromString} from '../../../src/protocol';
import {resetDragState, setDragState} from '../../../src/state';

//
// * Helpers
//

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

function makeDragState(overrides: Partial<DragState>): DragState {
  return {
    itemType: 'part',
    itemLabel: 'Hero Banner',
    sourcePath: path('/main/0'),
    targetRegion: undefined,
    targetIndex: undefined,
    dropAllowed: true,
    message: undefined,
    placeholderElement: undefined,
    placeholderVariant: undefined,
    x: 0,
    y: 0,
    ...overrides,
  };
}

//
// * Meta
//

const meta = {
  title: 'Placeholders/Drag Preview',
  parameters: {layout: 'centered'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * Examples
//

function DefaultDemo(): JSX.Element {
  useEffect(() => {
    setDragState(
      makeDragState({
        targetRegion: path('/main/1/left'),
        dropAllowed: true,
      }),
    );
    return resetDragState;
  }, []);

  return (
    <div className='h-32 w-120' style={{transform: 'translate(0, 0)'}}>
      <DragPreview />
    </div>
  );
}

export const DefaultExample: Story = {
  name: 'Examples / Default',
  render: () => <DefaultDemo />,
};

//
// * States
//

function ForbiddenDemo(): JSX.Element {
  useEffect(() => {
    setDragState(
      makeDragState({
        itemLabel: 'Two Column Layout',
        targetRegion: path('/main/1/left'),
        dropAllowed: false,
      }),
    );
    return resetDragState;
  }, []);

  return (
    <div className='h-32 w-120' style={{transform: 'translate(0, 0)'}}>
      <DragPreview />
    </div>
  );
}

export const Forbidden: Story = {
  name: 'States / Forbidden',
  render: () => <ForbiddenDemo />,
};
