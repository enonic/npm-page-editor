import {useEffect, useRef} from 'preact/hooks';

import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {ComponentEmptyPlaceholder} from '../../src/main/resources/assets/js/v2/components/ComponentEmptyPlaceholder';
import {createPlaceholderIsland} from '../../src/main/resources/assets/js/v2/rendering';

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
  title: 'Page Editor v2/Component Empty Placeholder',
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
      <ComponentEmptyPlaceholder descriptor='My Part Component' />
    </IslandMount>
  ),
};

export const DescriptorKey: Story = {
  name: 'Examples / Descriptor Key',
  render: () => (
    <IslandMount className='w-96'>
      <ComponentEmptyPlaceholder descriptor='com.example:my-widget' />
    </IslandMount>
  ),
};

//
// * Features
//

const SIZING_WIDTHS = [
  {label: 'Narrow', className: 'w-48'},
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
            <ComponentEmptyPlaceholder descriptor='Article Component' />
          </IslandMount>
        </div>
      ))}
    </div>
  ),
};
