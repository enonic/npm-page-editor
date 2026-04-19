import {useLayoutEffect, useRef} from 'preact/hooks';

import type {ComponentPath} from '../protocol';
import type {JSX} from 'preact';

import {useStoreValue} from '../hooks/use-store';
import {useI18n} from '../i18n';
import {$dragState} from '../state';

export type RegionPlaceholderProps = {
  path: ComponentPath;
  regionName: string;
};

const REGION_PLACEHOLDER_NAME = 'RegionPlaceholder';

export const RegionPlaceholder = ({path}: RegionPlaceholderProps): JSX.Element => {
  const dragState = useStoreValue($dragState);
  const t = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);

  // ! Toggle the *host* element (outside this shadow root) rather than
  // ! conditionally rendering null. The host keeps inline `width:100%;
  // ! height:100%`, so without this it keeps reserving flex space in the
  // ! region and squashes the drag anchor.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (el == null) return;
    const root = el.getRootNode();
    if (!(root instanceof ShadowRoot)) return;
    const host = root.host;
    if (!(host instanceof HTMLElement)) return;
    host.style.display = dragState?.targetRegion === path ? 'none' : 'block';
  }, [dragState?.targetRegion, path]);

  return (
    <div
      ref={rootRef}
      data-component={REGION_PLACEHOLDER_NAME}
      className='pe-shell h-full overflow-hidden bg-surface-neutral'
    >
      <div className='h-full p-2.5'>
        <div className='pe-dash flex h-full min-h-25 items-center justify-center px-4 py-2.5'>
          <p className='text-center text-subtle italic'>{t('field.region.empty')}</p>
        </div>
      </div>
    </div>
  );
};

RegionPlaceholder.displayName = REGION_PLACEHOLDER_NAME;
