import {useEffect, useRef} from 'preact/hooks';

import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {CSSProperties, JSX} from 'preact';

import {DragPlaceholder} from '../../src/main/resources/assets/js/page-editor/DragPlaceholder';

//
// * Helpers
//

type LegacyMountProps = {
  text?: string;
  dropAllowed?: boolean;
  style?: CSSProperties;
};

function LegacyMount({text, dropAllowed, style}: LegacyMountProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const placeholder = new DragPlaceholder();
    if (dropAllowed != null) placeholder.setDropAllowed(dropAllowed);
    if (text != null) placeholder.setText(text);
    container.appendChild(placeholder.getHTMLElement());

    return () => {
      container.replaceChildren();
    };
  }, [text, dropAllowed]);

  return <div ref={containerRef} style={style} />;
}

//
// * Meta
//

const meta = {
  title: 'Page Editor/Drag Placeholder',
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

//
// * Examples
//

export const Default: Story = {
  name: 'Examples / Default',
  render: () => <LegacyMount text='Drop here' style={{width: '640px'}} />,
};

//
// * States
//

export const DropAllowed: Story = {
  name: 'States / Drop Allowed',
  render: () => <LegacyMount text='Release to drop here' dropAllowed style={{width: '640px'}} />,
};

export const DropForbidden: Story = {
  name: 'States / Drop Forbidden',
  render: () => <LegacyMount text='Cannot drop this component here' dropAllowed={false} style={{width: '640px'}} />,
};
