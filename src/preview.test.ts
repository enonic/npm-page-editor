import {initPreview} from './preview';
import {tryGetChannel} from './transport';

type MockTarget = {target: Window; postMessage: ReturnType<typeof vi.fn<Window['postMessage']>>};

function createMockTarget(): MockTarget {
  const postMessage = vi.fn<Window['postMessage']>();
  return {target: {postMessage} as unknown as Window, postMessage};
}

describe('initPreview', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  //
  // * Channel & iframe-loaded
  //

  it('creates channel and emits iframe-loaded', () => {
    const {target, postMessage} = createMockTarget();

    const instance = initPreview(target);

    expect(tryGetChannel()).toBeDefined();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({version: 2, source: 'page-editor', type: 'iframe-loaded'}),
      '*',
    );

    instance.destroy();
  });

  //
  // * Link interception
  //

  it('intercepts anchor clicks and sends navigate message', () => {
    const {target, postMessage} = createMockTarget();
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/content/site/page');
    document.body.appendChild(anchor);

    const instance = initPreview(target);
    postMessage.mockClear();

    const event = new MouseEvent('click', {bubbles: true, cancelable: true});
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({type: 'navigate', path: '/content/site/page'}),
      '*',
    );

    instance.destroy();
  });

  it('accepts hostDomain option', () => {
    const {target} = createMockTarget();

    const instance = initPreview(target, {hostDomain: 'https://example.com'});

    expect(instance).toBeDefined();
    expect(tryGetChannel()).toBeDefined();

    instance.destroy();
  });

  //
  // * Idempotency
  //

  it('second initPreview call returns the existing instance and warns', () => {
    const {target: t1, postMessage: post1} = createMockTarget();
    const {target: t2, postMessage: post2} = createMockTarget();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const first = initPreview(t1);
    post1.mockClear();
    const second = initPreview(t2);

    expect(second).toBe(first);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(post2).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    first.destroy();
  });

  //
  // * Destroy
  //

  it('destroy stops link interception and resets channel', () => {
    const {target, postMessage} = createMockTarget();
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/content/site/page');
    document.body.appendChild(anchor);

    const instance = initPreview(target);
    instance.destroy();

    expect(tryGetChannel()).toBeUndefined();

    postMessage.mockClear();
    anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('destroy is idempotent', () => {
    const {target} = createMockTarget();
    const instance = initPreview(target);

    instance.destroy();
    expect(() => instance.destroy()).not.toThrow();
  });

  it('initPreview works fresh after destroy', () => {
    const {target: t1} = createMockTarget();
    const first = initPreview(t1);
    first.destroy();

    const {target: t2, postMessage: post2} = createMockTarget();
    const second = initPreview(t2);

    expect(second).not.toBe(first);
    expect(post2).toHaveBeenCalledWith(expect.objectContaining({type: 'iframe-loaded'}), '*');

    second.destroy();
  });
});
