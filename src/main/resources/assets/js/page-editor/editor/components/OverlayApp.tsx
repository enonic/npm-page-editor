import {useLayoutEffect, useRef, useState} from 'preact/hooks';

import type {JSX} from 'preact';

import {ContextMenu} from './overlay/context-menu';
import {DragPlaceholderPortal} from './overlay/DragPlaceholderPortal';
import {DragPreview} from './overlay/DragPreview';
import {DragTargetHighlighter} from './overlay/DragTargetHighlighter';
import {Highlighter} from './overlay/Highlighter';
import {PagePlaceholderOverlay} from './overlay/PagePlaceholderOverlay';
import {ParentPulseHighlighter} from './overlay/ParentPulseHighlighter';
import {SelectionHighlighter} from './overlay/SelectionHighlighter';
import {Shader} from './overlay/Shader';

const OVERLAY_APP_NAME = 'OverlayApp';

export const OverlayApp = (): JSX.Element => {
    const portalRef = useRef<HTMLDivElement>(null);
    const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>(undefined);

    useLayoutEffect(() => {
        if (portalRef.current != null) setPortalContainer(portalRef.current);
    }, []);

    return (
        <div data-component={OVERLAY_APP_NAME} className='pe-shell'>
            <DragPlaceholderPortal />
            <PagePlaceholderOverlay />
            <DragTargetHighlighter />
            <DragPreview />
            <Highlighter />
            <SelectionHighlighter />
            <ParentPulseHighlighter />
            <Shader />
            <ContextMenu portalContainer={portalContainer} />
            <div ref={portalRef} />
        </div>
    );
};

OverlayApp.displayName = OVERLAY_APP_NAME;
