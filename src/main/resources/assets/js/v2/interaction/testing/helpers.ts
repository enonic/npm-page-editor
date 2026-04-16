import {vi} from 'vitest';

import type {IncomingMessage, OutgoingMessage} from '../../protocol';
import type {Channel} from '../../transport';

export type FakeChannel = Channel & {
  messages: OutgoingMessage[];
  dispatch(msg: IncomingMessage): void;
};

export function createFakeChannel(): FakeChannel {
  const messages: OutgoingMessage[] = [];
  const handlers = new Set<(msg: IncomingMessage) => void>();
  return {
    send: vi.fn<Channel['send']>(msg => {
      messages.push(msg);
    }),
    subscribe: vi.fn<Channel['subscribe']>(handler => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    }),
    destroy: vi.fn<Channel['destroy']>(),
    messages,
    dispatch(msg: IncomingMessage): void {
      for (const handler of handlers) {
        handler(msg);
      }
    },
  };
}
