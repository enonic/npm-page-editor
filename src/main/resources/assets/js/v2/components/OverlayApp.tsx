import {useLayoutEffect, useRef, useState} from 'preact/hooks';

import type {JSX} from 'preact';

import {ContextMenu} from './ContextMenu';
import {DragPreview} from './DragPreview';
import {DragTargetHighlighter} from './DragTargetHighlighter';
import {Highlighter} from './Highlighter';
import {PagePlaceholderOverlay} from './PagePlaceholderOverlay';
import {SelectionHighlighter} from './SelectionHighlighter';
import {Shader} from './Shader';

const OVERLAY_APP_NAME = 'OverlayApp';

export const OverlayApp = (): JSX.Element => {
  // ? Portal the ContextMenu inside the overlay shadow root so it stacks as a
  //   sibling of Shader (z-30 < z-50). Otherwise the host's max z-index beats
  //   any ContextMenu portaled to document.body.
  const portalRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>(undefined);

  useLayoutEffect(() => {
    setPortalContainer(portalRef.current ?? undefined);
  }, []);

  return (
    <div data-component={OVERLAY_APP_NAME} className='pe-shell'>
      <PagePlaceholderOverlay />
      <DragTargetHighlighter />
      <DragPreview />
      <Highlighter />
      <SelectionHighlighter />
      <Shader />
      <div ref={portalRef} />
      <ContextMenu portalContainer={portalContainer} />
    </div>
  );
};

OverlayApp.displayName = OVERLAY_APP_NAME;
