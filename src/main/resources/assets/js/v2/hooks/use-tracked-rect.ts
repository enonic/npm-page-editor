import {useEffect, useState} from 'preact/compat';

import type {ComponentPath} from '../protocol';

import {markDirty, registerConsumer, trackElementResize} from '../geometry';
import {$registry, getRecord} from '../state';
import {useStoreValue} from './use-store';

export function useTrackedRect(path: ComponentPath | undefined): DOMRect | undefined {
  // ? Subscribe to $registry to re-derive `element` when reconciliation replaces the DOM node at this path
  const _registry = useStoreValue($registry);
  const element = path != null ? getRecord(path)?.element : undefined;
  const [rect, setRect] = useState<DOMRect | undefined>(undefined);

  useEffect(() => {
    if (path == null) {
      setRect(undefined);
      return undefined;
    }

    return registerConsumer(path, setRect);
  }, [path, element]);

  useEffect(() => {
    if (element == null) return undefined;

    return trackElementResize(element, markDirty);
  }, [path, element]);

  return rect;
}
