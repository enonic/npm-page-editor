import type {JSX} from 'preact';
import {ContextMenu} from './overlay/ContextMenu';
import {Highlighter} from './overlay/Highlighter';
import {SelectionHighlighter} from './overlay/SelectionHighlighter';
import {Shader} from './overlay/Shader';

export function OverlayApp(): JSX.Element {
    return (
        <div className='pe-shell'>
            <Highlighter />
            <SelectionHighlighter />
            <Shader />
            <ContextMenu />
        </div>
    );
}
