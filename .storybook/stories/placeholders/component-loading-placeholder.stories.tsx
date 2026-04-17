import {useEffect, useRef} from 'preact/hooks';

import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {ComponentLoadingPlaceholder} from '../../../src/components/ComponentLoadingPlaceholder';
import {ComponentPlaceholder} from '../../../src/components/ComponentPlaceholder';
import {createPlaceholderIsland} from '../../../src/rendering';

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
  title: 'Placeholders/Component Loading Placeholder',
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * Examples
//

export const Basic: Story = {
  name: 'Examples / Basic',
  render: () => (
    <IslandMount className='w-96'>
      <ComponentLoadingPlaceholder />
    </IslandMount>
  ),
};

//
// * States
//

export const Comparison: Story = {
  name: 'States / Loading vs Static',
  render: () => (
    <div className='flex w-96 flex-col gap-4'>
      <div>
        <p className='mb-1.5 text-xs text-subtle'>Loading</p>
        <IslandMount>
          <ComponentLoadingPlaceholder />
        </IslandMount>
      </div>
      <div>
        <p className='mb-1.5 text-xs text-subtle'>Static (part)</p>
        <IslandMount>
          <ComponentPlaceholder type='part' />
        </IslandMount>
      </div>
    </div>
  ),
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
            <ComponentLoadingPlaceholder />
          </IslandMount>
        </div>
      ))}
    </div>
  ),
};
