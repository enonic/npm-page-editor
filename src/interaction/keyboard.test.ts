import type {ComponentPath} from '../protocol';

import {fromString, root} from '../protocol';
import {$selectedPath, resetDragState, setDragState, setSelectedPath} from '../state';
import {initKeyboardHandling} from './keyboard';
import {createFakeChannel} from './testing/helpers';

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

describe('keyboard', () => {
  let cleanup: () => void;
  let channel: ReturnType<typeof createFakeChannel>;

  beforeEach(() => {
    resetDragState();
    $selectedPath.set(undefined);
    channel = createFakeChannel();
  });

  afterEach(() => {
    cleanup();
  });

  describe('initKeyboardHandling', () => {
    //
    // * Forwarding
    //

    it('forwards keydown with modifier to channel', () => {
      cleanup = initKeyboardHandling(channel);

      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'a',
          keyCode: 65,
          ctrlKey: true,
          bubbles: true,
        }),
      );

      expect(channel.messages).toEqual([
        expect.objectContaining({
          type: 'keyboard-event',
          eventType: 'keydown',
          key: 'a',
          keyCode: 65,
          modifiers: {ctrl: true, alt: false, shift: false, meta: false},
        }),
      ]);
    });

    it('forwards keyup events', () => {
      cleanup = initKeyboardHandling(channel);

      document.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: 'Control',
          keyCode: 17,
          ctrlKey: true,
          bubbles: true,
        }),
      );

      expect(channel.messages).toHaveLength(1);
      expect(channel.messages[0]).toEqual(expect.objectContaining({eventType: 'keyup'}));
    });

    it('ignores key events without modifier or editor combo', () => {
      cleanup = initKeyboardHandling(channel);

      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'a',
          keyCode: 65,
          bubbles: true,
        }),
      );

      expect(channel.messages).toEqual([]);
    });

    //
    // * Editor Combos
    //

    it('prevents default for mod+s', () => {
      cleanup = initKeyboardHandling(channel);

      const event = new KeyboardEvent('keydown', {
        key: 's',
        keyCode: 83,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(channel.messages).toHaveLength(1);
    });

    it('forwards Backspace as editor combo without modifier', () => {
      cleanup = initKeyboardHandling(channel);

      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Backspace',
          keyCode: 8,
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(channel.messages).toHaveLength(1);
      expect(channel.messages[0]).toEqual(expect.objectContaining({key: 'Backspace'}));
    });

    it('forwards Delete as editor combo without modifier', () => {
      cleanup = initKeyboardHandling(channel);

      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Delete',
          keyCode: 46,
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(channel.messages).toHaveLength(1);
      expect(channel.messages[0]).toEqual(expect.objectContaining({key: 'Delete'}));
    });

    //
    // * Delete Removes Selected Component
    //

    it('Delete with non-root selection sends remove and not keyboard-event', () => {
      setSelectedPath(path('/main/0'));
      cleanup = initKeyboardHandling(channel);

      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        keyCode: 46,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(channel.messages).toEqual([{type: 'remove', path: path('/main/0')}]);
    });

    it('Backspace with non-root selection sends remove and not keyboard-event', () => {
      setSelectedPath(path('/main/0'));
      cleanup = initKeyboardHandling(channel);

      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Backspace',
          keyCode: 8,
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(channel.messages).toEqual([{type: 'remove', path: path('/main/0')}]);
    });

    it('Ctrl+Delete with selection forwards as keyboard-event, does not send remove', () => {
      setSelectedPath(path('/main/0'));
      cleanup = initKeyboardHandling(channel);

      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Delete',
          keyCode: 46,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(channel.messages).toHaveLength(1);
      expect(channel.messages[0]).toEqual(expect.objectContaining({type: 'keyboard-event', key: 'Delete'}));
    });

    it('Delete with no selection falls through to keyboard-event forwarding', () => {
      cleanup = initKeyboardHandling(channel);

      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Delete',
          keyCode: 46,
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(channel.messages).toHaveLength(1);
      expect(channel.messages[0]).toEqual(expect.objectContaining({type: 'keyboard-event', key: 'Delete'}));
    });

    it('Delete with root selection does not send remove', () => {
      setSelectedPath(root());
      cleanup = initKeyboardHandling(channel);

      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Delete',
          keyCode: 46,
          bubbles: true,
          cancelable: true,
        }),
      );

      const removeMessages = channel.messages.filter(m => m.type === 'remove');
      expect(removeMessages).toEqual([]);
      expect(channel.messages).toHaveLength(1);
      expect(channel.messages[0]).toEqual(expect.objectContaining({type: 'keyboard-event'}));
    });

    it('Delete keyup with selection does not send remove', () => {
      setSelectedPath(path('/main/0'));
      cleanup = initKeyboardHandling(channel);

      document.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: 'Delete',
          keyCode: 46,
          bubbles: true,
          cancelable: true,
        }),
      );

      const removeMessages = channel.messages.filter(m => m.type === 'remove');
      expect(removeMessages).toEqual([]);
    });

    //
    // * Guards
    //

    it('ignores events during drag', () => {
      const p = path('/main/0');
      setDragState({
        itemType: 'part',
        itemLabel: 'Part',
        sourcePath: p,
        targetRegion: undefined,
        targetIndex: undefined,
        dropAllowed: false,
        message: undefined,
        placeholderElement: undefined,
        placeholderVariant: undefined,
        x: undefined,
        y: undefined,
      });

      cleanup = initKeyboardHandling(channel);

      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 's',
          keyCode: 83,
          ctrlKey: true,
          bubbles: true,
        }),
      );

      expect(channel.messages).toEqual([]);
    });

    //
    // * Cleanup
    //

    it('removes listeners on cleanup', () => {
      cleanup = initKeyboardHandling(channel);
      cleanup();

      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 's',
          keyCode: 83,
          ctrlKey: true,
          bubbles: true,
        }),
      );

      expect(channel.messages).toEqual([]);
    });
  });
});
