import {initNavigationInterception} from './navigation';
import {createFakeChannel} from './testing/helpers';

describe('navigation', () => {
  let cleanup: () => void;
  let channel: ReturnType<typeof createFakeChannel>;

  beforeEach(() => {
    channel = createFakeChannel();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  describe('initNavigationInterception', () => {
    //
    // * Link Interception
    //

    it('intercepts click on anchor and sends navigate message', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', '/content/site/page');
      document.body.appendChild(anchor);

      cleanup = initNavigationInterception(channel);

      const event = new MouseEvent('click', {bubbles: true, cancelable: true});
      anchor.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(channel.messages).toContainEqual({type: 'navigate', path: '/content/site/page'});
    });

    it('intercepts click on child of anchor', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', '/content/site/page');
      const span = document.createElement('span');
      anchor.appendChild(span);
      document.body.appendChild(anchor);

      cleanup = initNavigationInterception(channel);

      span.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

      expect(channel.messages).toContainEqual({type: 'navigate', path: '/content/site/page'});
    });

    it('ignores click on non-anchor element', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      cleanup = initNavigationInterception(channel);

      div.dispatchEvent(new MouseEvent('click', {bubbles: true}));

      const navigateMessages = channel.messages.filter(m => m.type === 'navigate');
      expect(navigateMessages).toEqual([]);
    });

    it('ignores anchor with no href', () => {
      const anchor = document.createElement('a');
      document.body.appendChild(anchor);

      cleanup = initNavigationInterception(channel);

      anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

      const navigateMessages = channel.messages.filter(m => m.type === 'navigate');
      expect(navigateMessages).toEqual([]);
    });

    it('ignores anchor with javascript: href', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', 'javascript:void(0)');
      document.body.appendChild(anchor);

      cleanup = initNavigationInterception(channel);

      anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

      const navigateMessages = channel.messages.filter(m => m.type === 'navigate');
      expect(navigateMessages).toEqual([]);
    });

    it('ignores anchor with hash-only href', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', '#section');
      document.body.appendChild(anchor);

      cleanup = initNavigationInterception(channel);

      anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

      const navigateMessages = channel.messages.filter(m => m.type === 'navigate');
      expect(navigateMessages).toEqual([]);
    });

    it('intercepts internal relative path even without hostDomain', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', '/content/site/page');
      document.body.appendChild(anchor);

      cleanup = initNavigationInterception(channel, {hostDomain: 'https://example.com'});

      anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

      expect(channel.messages).toContainEqual({type: 'navigate', path: '/content/site/page'});
    });

    //
    // * hostDomain Classifier
    //

    it('intercepts absolute URL when it matches hostDomain', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', 'https://example.com/content/page');
      document.body.appendChild(anchor);

      cleanup = initNavigationInterception(channel, {hostDomain: 'https://example.com'});

      anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

      expect(channel.messages).toContainEqual({type: 'navigate', path: 'https://example.com/content/page'});
    });

    it('ignores absolute URL that does not match hostDomain', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', 'https://other.example/page');
      document.body.appendChild(anchor);

      cleanup = initNavigationInterception(channel, {hostDomain: 'https://example.com'});

      const event = new MouseEvent('click', {bubbles: true, cancelable: true});
      anchor.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(channel.messages.filter(m => m.type === 'navigate')).toEqual([]);
    });

    it('ignores download link regardless of href', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', '/files/report.pdf');
      anchor.setAttribute('download', '');
      document.body.appendChild(anchor);

      cleanup = initNavigationInterception(channel);

      const event = new MouseEvent('click', {bubbles: true, cancelable: true});
      anchor.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(channel.messages.filter(m => m.type === 'navigate')).toEqual([]);
    });

    it('uses data-content-path instead of href when present', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', 'https://public.example/slug');
      anchor.setAttribute('data-content-path', '/content/site/target');
      document.body.appendChild(anchor);

      cleanup = initNavigationInterception(channel, {hostDomain: 'https://example.com'});

      anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

      expect(channel.messages).toContainEqual({type: 'navigate', path: '/content/site/target'});
    });

    it('ignores absolute URL and warns once when hostDomain is missing', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', 'https://example.com/page');
      document.body.appendChild(anchor);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      cleanup = initNavigationInterception(channel);

      anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
      anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

      expect(channel.messages.filter(m => m.type === 'navigate')).toEqual([]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain('hostDomain');
    });

    //
    // * Iframe Loaded
    //

    it('sends iframe-loaded immediately when readyState is complete', () => {
      // jsdom readyState is 'complete' by default in tests
      cleanup = initNavigationInterception(channel);

      expect(channel.messages).toContainEqual({type: 'iframe-loaded'});
    });

    //
    // * Cleanup
    //

    it('removes listeners on cleanup', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', '/content/site/page');
      document.body.appendChild(anchor);

      cleanup = initNavigationInterception(channel);
      // Clear the iframe-loaded message from init
      channel.messages.length = 0;
      cleanup();

      anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

      expect(channel.messages).toEqual([]);
    });
  });
});
