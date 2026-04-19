import type {Modifiers} from '../protocol';
import type {Channel} from '../transport';

import {isRoot} from '../protocol';
import {getSelectedPath, isDragging} from '../state';

// Known editor combos that should not reach the browser
const EDITOR_COMBOS: {key: string; mod?: boolean; alt?: boolean}[] = [
  {key: 's', mod: true},
  {key: 'Delete', mod: true},
  {key: 'Escape', mod: true},
  {key: 'F4', mod: true, alt: true},
  {key: 'Backspace'},
  {key: 'Delete'},
];

function isEditorCombo(event: KeyboardEvent): boolean {
  const isMod = event.ctrlKey || event.metaKey;
  const isAlt = event.altKey;

  return EDITOR_COMBOS.some(combo => {
    if (event.key !== combo.key) return false;
    if (combo.mod && !isMod) return false;
    if (combo.alt && !isAlt) return false;
    return true;
  });
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
}

function isDeleteKey(event: KeyboardEvent): boolean {
  return event.key === 'Delete' || event.key === 'Backspace';
}

export function initKeyboardHandling(channel: Channel): () => void {
  const handleKeyEvent = (event: KeyboardEvent): void => {
    if (isDragging()) return;

    if (event.type === 'keydown' && isDeleteKey(event) && !hasModifier(event)) {
      const selected = getSelectedPath();
      if (selected != null && !isRoot(selected)) {
        event.preventDefault();
        channel.send({type: 'remove', path: selected});
        return;
      }
    }

    const isCombo = isEditorCombo(event);
    if (!hasModifier(event) && !isCombo) return;

    if (isCombo) {
      event.preventDefault();
    }

    const modifiers: Modifiers = {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
    };

    channel.send({
      type: 'keyboard-event',
      eventType: event.type,
      key: event.key,
      keyCode: event.keyCode, // eslint-disable-line typescript/no-deprecated -- protocol requires keyCode
      modifiers,
    });
  };

  document.addEventListener('keydown', handleKeyEvent);
  document.addEventListener('keyup', handleKeyEvent);

  return () => {
    document.removeEventListener('keydown', handleKeyEvent);
    document.removeEventListener('keyup', handleKeyEvent);
  };
}
