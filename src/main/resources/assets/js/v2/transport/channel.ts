import type {IncomingMessage, OutgoingMessage} from '../protocol';

import {INCOMING_MESSAGE_TYPES} from '../protocol';

export type MessageHandler = (message: IncomingMessage) => void;

export type Channel = {
  send(message: OutgoingMessage): void;
  subscribe(handler: MessageHandler): () => void;
  destroy(): void;
};

export function createChannel(target: Window, origin?: string): Channel {
  const handlers = new Set<MessageHandler>();
  let destroyed = false;

  const listener = (event: MessageEvent): void => {
    const data: unknown = event.data;
    if (data == null || typeof data !== 'object') return;

    const wire = data as Record<string, unknown>;
    if (wire.version !== 2 || wire.source !== 'page-editor') return;
    if (origin != null && event.origin !== origin) return;

    const {version: _, source: __, ...message} = wire;
    if (typeof message.type !== 'string' || !INCOMING_MESSAGE_TYPES.has(message.type as IncomingMessage['type']))
      return;

    for (const handler of handlers) {
      handler(message as IncomingMessage);
    }
  };

  globalThis.addEventListener('message', listener);

  return {
    send(message: OutgoingMessage): void {
      if (destroyed) return;
      target.postMessage({version: 2, source: 'page-editor', ...message}, origin ?? '*');
    },

    subscribe(handler: MessageHandler): () => void {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    destroy(): void {
      destroyed = true;
      globalThis.removeEventListener('message', listener);
      handlers.clear();
    },
  };
}

//
// * Module Singleton
//

let channel: Channel | undefined;

export function setChannel(ch: Channel): void {
  if (channel != null) {
    channel.destroy();
  }
  channel = ch;
}

export function getChannel(): Channel {
  if (channel == null) {
    throw new Error('Channel not initialized. Call setChannel() first.');
  }
  return channel;
}

export function resetChannel(): void {
  if (channel != null) {
    channel.destroy();
  }
  channel = undefined;
}
