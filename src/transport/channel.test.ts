import type {OutgoingMessage} from '../protocol';
import type {MessageHandler} from './channel';

import {createChannel, getChannel, resetChannel, setChannel} from './channel';

function emit(data: unknown, origin = ''): void {
  globalThis.dispatchEvent(new MessageEvent('message', {data, origin}));
}

function wire(message: Record<string, unknown>): Record<string, unknown> {
  return {version: 2, source: 'page-editor', ...message};
}

function createMockTarget(): {target: Window; postMessage: ReturnType<typeof vi.fn<Window['postMessage']>>} {
  const postMessage = vi.fn<Window['postMessage']>();
  return {target: {postMessage} as unknown as Window, postMessage};
}

describe('channel', () => {
  afterEach(() => {
    resetChannel();
  });

  describe('createChannel', () => {
    describe('send', () => {
      it('posts message with version and source envelope', () => {
        const {target, postMessage} = createMockTarget();
        const channel = createChannel(target);

        const message: OutgoingMessage = {type: 'ready'};
        channel.send(message);

        expect(postMessage).toHaveBeenCalledWith({version: 2, source: 'page-editor', type: 'ready'}, '*');

        channel.destroy();
      });

      it('uses provided origin as targetOrigin', () => {
        const {target, postMessage} = createMockTarget();
        const channel = createChannel(target, 'https://studio.example.com');

        channel.send({type: 'ready'});

        expect(postMessage).toHaveBeenCalledWith(
          expect.objectContaining({type: 'ready'}),
          'https://studio.example.com',
        );

        channel.destroy();
      });

      it('defaults to "*" when no origin provided', () => {
        const {target, postMessage} = createMockTarget();
        const channel = createChannel(target);

        channel.send({type: 'ready'});

        expect(postMessage).toHaveBeenCalledWith(expect.any(Object), '*');

        channel.destroy();
      });
    });

    describe('subscribe', () => {
      it('receives messages matching source and version', () => {
        const channel = createChannel(window);
        const handler = vi.fn<MessageHandler>();
        channel.subscribe(handler);

        emit(wire({type: 'set-lock', locked: true}));

        expect(handler).toHaveBeenCalledWith({type: 'set-lock', locked: true});

        channel.destroy();
      });

      it('ignores messages with wrong source', () => {
        const channel = createChannel(window);
        const handler = vi.fn<MessageHandler>();
        channel.subscribe(handler);

        emit({version: 2, source: 'other-app', type: 'set-lock', locked: true});

        expect(handler).not.toHaveBeenCalled();

        channel.destroy();
      });

      it('ignores messages with wrong version', () => {
        const channel = createChannel(window);
        const handler = vi.fn<MessageHandler>();
        channel.subscribe(handler);

        emit({version: 1, source: 'page-editor', type: 'set-lock', locked: true});

        expect(handler).not.toHaveBeenCalled();

        channel.destroy();
      });

      it('ignores messages with no data', () => {
        const channel = createChannel(window);
        const handler = vi.fn<MessageHandler>();
        channel.subscribe(handler);

        emit(null);
        emit(undefined);

        expect(handler).not.toHaveBeenCalled();

        channel.destroy();
      });

      it('ignores messages with unknown type', () => {
        const channel = createChannel(window);
        const handler = vi.fn<MessageHandler>();
        channel.subscribe(handler);

        emit(wire({type: 'unknown-message'}));
        emit(wire({type: ''}));
        emit(wire({}));

        expect(handler).not.toHaveBeenCalled();

        channel.destroy();
      });

      it('validates origin when configured', () => {
        const channel = createChannel(window, 'https://studio.example.com');
        const handler = vi.fn<MessageHandler>();
        channel.subscribe(handler);

        emit(wire({type: 'set-lock', locked: true}), 'https://evil.example.com');

        expect(handler).not.toHaveBeenCalled();

        channel.destroy();
      });

      it('allows any origin when not configured', () => {
        const channel = createChannel(window);
        const handler = vi.fn<MessageHandler>();
        channel.subscribe(handler);

        emit(wire({type: 'set-lock', locked: true}), 'https://any-origin.example.com');

        expect(handler).toHaveBeenCalled();

        channel.destroy();
      });

      it('supports multiple concurrent handlers', () => {
        const channel = createChannel(window);
        const first = vi.fn<MessageHandler>();
        const second = vi.fn<MessageHandler>();
        channel.subscribe(first);
        channel.subscribe(second);

        emit(wire({type: 'set-lock', locked: true}));

        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();

        channel.destroy();
      });

      it('returns unsubscribe function that stops delivery', () => {
        const channel = createChannel(window);
        const handler = vi.fn<MessageHandler>();
        const unsubscribe = channel.subscribe(handler);

        unsubscribe();
        emit(wire({type: 'set-lock', locked: true}));

        expect(handler).not.toHaveBeenCalled();

        channel.destroy();
      });
    });

    describe('destroy', () => {
      it('stops all message delivery', () => {
        const channel = createChannel(window);
        const handler = vi.fn<MessageHandler>();
        channel.subscribe(handler);

        channel.destroy();
        emit(wire({type: 'set-lock', locked: true}));

        expect(handler).not.toHaveBeenCalled();
      });

      it('is idempotent', () => {
        const channel = createChannel(window);
        channel.destroy();
        expect(() => channel.destroy()).not.toThrow();
      });

      it('silently ignores send after destroy', () => {
        const {target, postMessage} = createMockTarget();
        const channel = createChannel(target);

        channel.destroy();
        channel.send({type: 'ready'});

        expect(postMessage).not.toHaveBeenCalled();
      });
    });
  });

  describe('setChannel / getChannel', () => {
    it('stores and retrieves a channel', () => {
      const channel = createChannel(window);
      setChannel(channel);
      expect(getChannel()).toBe(channel);
    });

    it('throws when no channel set', () => {
      expect(() => getChannel()).toThrow('Channel not initialized');
    });

    it('destroys previous channel when setting new one', () => {
      const first = createChannel(window);
      const handler = vi.fn<MessageHandler>();
      first.subscribe(handler);
      setChannel(first);

      const second = createChannel(window);
      setChannel(second);

      emit(wire({type: 'set-lock', locked: true}));

      // ? First channel's handler should not fire — it was destroyed by setChannel
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('resetChannel', () => {
    it('destroys and clears reference', () => {
      const channel = createChannel(window);
      const handler = vi.fn<MessageHandler>();
      channel.subscribe(handler);
      setChannel(channel);

      resetChannel();

      emit(wire({type: 'set-lock', locked: true}));
      expect(handler).not.toHaveBeenCalled();
      expect(() => getChannel()).toThrow();
    });

    it('safe to call when no channel exists', () => {
      expect(() => resetChannel()).not.toThrow();
    });
  });
});
