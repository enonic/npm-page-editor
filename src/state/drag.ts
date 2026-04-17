import {atom} from 'nanostores';

import type {ComponentPath, ComponentType} from '../protocol';

export type DragPlaceholderVariant = 'slot' | 'region';

export type DragState = {
  itemType: ComponentType;
  itemLabel: string;
  sourcePath: ComponentPath | undefined;
  targetRegion: ComponentPath | undefined;
  targetIndex: number | undefined;
  dropAllowed: boolean;
  message: string | undefined;
  placeholderElement: HTMLElement | undefined;
  placeholderVariant: DragPlaceholderVariant | undefined;
  x: number | undefined;
  y: number | undefined;
};

const POST_DRAG_COOLDOWN_MS = 100;

let postDragCooldown = false;
let cooldownTimer: ReturnType<typeof setTimeout> | undefined;

export const $dragState = atom<DragState | undefined>(undefined);

export function setDragState(state: DragState | undefined): void {
  // Guard: reject new drag if one is already active
  if (state != null && isDragging()) return;

  if (state == null && isDragging()) {
    // Ending a drag: start cooldown
    postDragCooldown = true;
    if (cooldownTimer != null) clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(() => {
      postDragCooldown = false;
      cooldownTimer = undefined;
    }, POST_DRAG_COOLDOWN_MS);
  } else if (state != null) {
    // Starting a new drag: clear any lingering cooldown
    postDragCooldown = false;
    if (cooldownTimer != null) {
      clearTimeout(cooldownTimer);
      cooldownTimer = undefined;
    }
  }

  $dragState.set(state);
}

export function updateDragState(partial: Partial<DragState>): void {
  const current = $dragState.get();
  if (current == null) return;
  $dragState.set({...current, ...partial});
}

export function getDragState(): DragState | undefined {
  return $dragState.get();
}

export function isDragging(): boolean {
  return $dragState.get() != null;
}

export function isPostDragCooldown(): boolean {
  return postDragCooldown;
}

export function resetDragState(): void {
  $dragState.set(undefined);
  postDragCooldown = false;
  if (cooldownTimer != null) {
    clearTimeout(cooldownTimer);
    cooldownTimer = undefined;
  }
}
