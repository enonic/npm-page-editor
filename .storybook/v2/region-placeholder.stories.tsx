import {useEffect, useRef} from 'preact/hooks';

import type {ComponentPath} from '../../src/main/resources/assets/js/v2/protocol';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {RegionPlaceholder} from '../../src/main/resources/assets/js/v2/components/RegionPlaceholder';
import {createPlaceholderIsland} from '../../src/main/resources/assets/js/v2/rendering';
import {$dragState} from '../../src/main/resources/assets/js/v2/state';

//
// * Helpers
//

type IslandMountProps = {
  children: preact.ComponentChildren;
  className?: string;
};

function IslandMount({children, className}: IslandMountProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const island = createPlaceholderIsland(containerRef.current, children);
    return () => island.unmount();
  }, [children]);

  return <div ref={containerRef} className={className} />;
}

const REGION_PATH = '/main' as ComponentPath;

//
// * Meta
//

const meta = {
  title: 'Page Editor v2/Region Placeholder',
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * States
//

function HiddenDuringDragStory(): JSX.Element {
  useEffect(() => {
    $dragState.set({
      itemType: 'part',
      itemLabel: 'My Part',
      sourcePath: undefined,
      targetRegion: REGION_PATH,
      targetIndex: 0,
      dropAllowed: true,
      placeholderElement: undefined,
      x: undefined,
      y: undefined,
    });
    return () => $dragState.set(undefined);
  }, []);

  return (
    <div className='flex w-96 flex-col gap-4'>
      <div>
        <p className='mb-1.5 text-xs text-subtle'>Drag target matches — hidden</p>
        <IslandMount>
          <RegionPlaceholder path={REGION_PATH} regionName='main' />
        </IslandMount>
        <p className='mt-1.5 text-sm text-subtle italic'>
          The placeholder above is hidden because a component is being dragged into this region.
        </p>
      </div>
      <div>
        <p className='mb-1.5 text-xs text-subtle'>Other region — visible</p>
        <IslandMount>
          <RegionPlaceholder path={'/sidebar' as ComponentPath} regionName='sidebar' />
        </IslandMount>
      </div>
    </div>
  );
}

export const HiddenDuringDrag: Story = {
  name: 'States / Hidden During Drag',
  render: () => <HiddenDuringDragStory />,
};

//
// * Features
//

const SIZING_WIDTHS = [
  {label: 'Compact', className: 'w-40'},
  {label: 'Normal', className: 'w-96'},
] as const;

export const Sizing: Story = {
  name: 'Features / Sizing',
  render: () => (
    <div className='flex max-w-xl flex-col items-start gap-x-8 gap-y-6'>
      {SIZING_WIDTHS.map(({label, className}) => (
        <div key={label}>
          <p className='mb-1.5 text-xs text-subtle'>
            {label} — {className}
          </p>
          <IslandMount className={className}>
            <RegionPlaceholder path={REGION_PATH} regionName='main' />
          </IslandMount>
        </div>
      ))}
    </div>
  ),
};
