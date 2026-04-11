import type {JSX} from 'preact';
import {ContextMenu} from './overlay/ContextMenu';
import {DragPlaceholderPortal} from './overlay/DragPlaceholderPortal';
import {DragPreview} from './overlay/DragPreview';
import {DragTargetHighlighter} from './overlay/DragTargetHighlighter';
import {Highlighter} from './overlay/Highlighter';
import {PagePlaceholderOverlay} from './overlay/PagePlaceholderOverlay';
import {SelectionHighlighter} from './overlay/SelectionHighlighter';
import {Shader} from './overlay/Shader';

export function OverlayApp(): JSX.Element {
    return (
        <div className='pe-shell'>
            <DragPlaceholderPortal />
            <PagePlaceholderOverlay />
            <DragTargetHighlighter />
            <DragPreview />
            <Highlighter />
            <SelectionHighlighter />
            <Shader />
            <ContextMenu />
        </div>
    );
}
