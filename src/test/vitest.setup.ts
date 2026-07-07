// jsdom leaves `document.referrer` empty, so the editor bus can't resolve a host
// origin and logs a wildcard warning on every `initTransport()`. Pin a referrer so
// tests resolve a concrete origin and stay quiet (see editor/transport/bus.ts).
Object.defineProperty(document, 'referrer', {
    value: 'https://host.test',
    configurable: true,
});

export {};
