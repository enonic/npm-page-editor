import {useEffect, useRef} from 'preact/hooks';

import type {ComponentType} from '../../../src/main/resources/assets/js/v2/protocol';
import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {ComponentPlaceholder} from '../../../src/main/resources/assets/js/v2/components/ComponentPlaceholder';
import {createPlaceholderIsland} from '../../../src/main/resources/assets/js/v2/rendering';

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

//
// * Meta
//

const meta = {
  title: 'Placeholders/Component Placeholder',
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * Examples
//

export const AllTypes: Story = {
  name: 'Examples / All Types',
  // parameters: {layout: 'fullscreen'},
  render: () => (
    <div className='@container w-sm md:w-xl'>
      <div className='grid grid-cols-1 gap-4 @md:grid-cols-2'>
        {(['text', 'part', 'layout', 'fragment'] as const satisfies ComponentType[]).map(type => (
          <div key={type}>
            <IslandMount>
              <ComponentPlaceholder type={type} />
            </IslandMount>
            <p className='mt-1.5 text-center text-xs text-subtle'>{type}</p>
          </div>
        ))}
      </div>
    </div>
  ),
};

//
// * Features
//

const SIZING_WIDTHS = [
  {label: 'Collapsed', className: 'w-24'},
  {label: 'Compact', className: 'w-40'},
  {label: 'Narrow', className: 'w-64'},
  {label: 'Normal', className: 'w-96'},
  {label: 'Wide', className: 'w-144'},
] as const;

export const Sizing: Story = {
  name: 'Features / Sizing',
  render: () => (
    <div className='flex max-w-xl flex-wrap items-start gap-x-8 gap-y-6'>
      {SIZING_WIDTHS.map(({label, className}) => (
        <div key={label}>
          <p className='mb-1.5 text-xs text-subtle'>
            {label} — {className}
          </p>
          <IslandMount className={className}>
            <ComponentPlaceholder type='part' />
          </IslandMount>
        </div>
      ))}
    </div>
  ),
};
