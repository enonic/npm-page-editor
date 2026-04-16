import type {Meta, StoryObj} from '@storybook/preact-vite';

import {DragPlaceholder} from '../../src/main/resources/assets/js/v2/components/DragPlaceholder';

//
// * Meta
//

const meta = {
  title: 'Page Editor v2/Drag Placeholder',
  parameters: {layout: 'centered'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * Examples
//

export const Default: Story = {
  name: 'Examples / Default',
  render: () => (
    <div className='w-96'>
      <DragPlaceholder itemLabel='Hero Banner' dropAllowed />
    </div>
  ),
};

//
// * States
//

export const Error: Story = {
  name: 'States / Error',
  render: () => (
    <div className='w-96'>
      <DragPlaceholder itemLabel='Two Column Layout' dropAllowed={false} />
    </div>
  ),
};

export const CustomError: Story = {
  name: 'States / Custom Error',
  render: () => (
    <div className='w-96'>
      <DragPlaceholder itemLabel='Text Part' dropAllowed={false} message='Layouts cannot be nested.' />
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
          <div className={className}>
            <DragPlaceholder itemLabel='Hero Banner' dropAllowed />
          </div>
        </div>
      ))}
    </div>
  ),
};
