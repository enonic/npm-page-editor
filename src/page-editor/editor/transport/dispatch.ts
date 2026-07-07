/**
 * Editor → host notifications that also need a local store side effect: the
 * store mutation is applied at the fire site alongside the post.
 *
 * Fire-and-forget posts with no store side effect call `getBus()?.post` directly.
 */

import type {ClickPosition} from '../../protocol';

import {closeContextMenu, setSelectedPath} from '../stores/registry';
import {getBus} from './bus';

/**
 * Selects a component locally and notifies the host. `position` stays nullable:
 * programmatic selections fire `null`.
 */
export function dispatchComponentSelected(path: string, position?: ClickPosition, rightClicked?: boolean): void {
    setSelectedPath(path);
    getBus()?.post('component-selected', {path, position, rightClicked});
}

/**
 * Clears the local selection and notifies the host.
 */
export function dispatchComponentDeselected(path?: string): void {
    setSelectedPath(undefined);
    closeContextMenu();
    getBus()?.post('component-deselected', {path});
}
