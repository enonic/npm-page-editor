import {vi} from 'vitest';

import type {OutgoingMessage} from '../../protocol';
import type {Channel} from '../../transport';

export type FakeChannel = Channel & {messages: OutgoingMessage[]};

export function createFakeChannel(): FakeChannel {
  const messages: OutgoingMessage[] = [];
  return {
    send: vi.fn<Channel['send']>(msg => {
      messages.push(msg);
    }),
    subscribe: vi.fn<Channel['subscribe']>(() => () => undefined),
    destroy: vi.fn<Channel['destroy']>(),
    messages,
  };
}
