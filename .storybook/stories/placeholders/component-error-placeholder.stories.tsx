import {useEffect, useRef} from 'preact/hooks';

import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {ComponentErrorPlaceholder} from '../../../src/components/ComponentErrorPlaceholder';
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
  title: 'Placeholders/Component Error Placeholder',
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * Examples
//

export const WithMessage: Story = {
  name: 'Examples / With Message',
  render: () => (
    <IslandMount className='w-96'>
      <ComponentErrorPlaceholder descriptor='com.example:broken-widget — Failed to render: java.lang.NullPointerException' />
    </IslandMount>
  ),
};

export const DefaultMessage: Story = {
  name: 'Examples / Default Message',
  render: () => (
    <IslandMount className='w-96'>
      <ComponentErrorPlaceholder />
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
            <ComponentErrorPlaceholder descriptor='Rendering failed for unknown reason.' />
          </IslandMount>
        </div>
      ))}
    </div>
  ),
};
