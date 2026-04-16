import type {JSX} from 'preact';

import {ContextMenu} from './ContextMenu';
import {DragPreview} from './DragPreview';
import {DragTargetHighlighter} from './DragTargetHighlighter';
import {Highlighter} from './Highlighter';
import {PagePlaceholderOverlay} from './PagePlaceholderOverlay';
import {SelectionHighlighter} from './SelectionHighlighter';
import {Shader} from './Shader';

const OVERLAY_APP_NAME = 'OverlayApp';

export const OverlayApp = (): JSX.Element => (
  <div data-component={OVERLAY_APP_NAME} className='pe-shell'>
    <PagePlaceholderOverlay />
    <DragTargetHighlighter />
    <DragPreview />
    <Highlighter />
    <SelectionHighlighter />
    <Shader />
    <ContextMenu />
  </div>
);

OverlayApp.displayName = OVERLAY_APP_NAME;
