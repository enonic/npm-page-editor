import {parsePage} from './parse-page';

describe('parsePage', () => {
  it('builds a path-first registry from nested regions and components', () => {
    document.body.innerHTML = `
      <main>
        <section data-portal-region="main">
          <article data-portal-component-type="part"></article>
          <div>
            <section data-portal-component-type="layout">
              <div data-portal-region="left">
                <div data-portal-component-type="text">Body</div>
              </div>
            </section>
          </div>
        </section>
      </main>
    `;

    const records = parsePage(document.body);

    expect(records['/']).toMatchObject({
      type: 'page',
      children: ['/main'],
    });
    expect(records['/main']).toMatchObject({
      type: 'region',
      parentPath: '/',
      children: ['/main/0', '/main/1'],
      empty: false,
    });
    expect(records['/main/0']).toMatchObject({
      type: 'part',
      parentPath: '/main',
      children: [],
    });
    expect(records['/main/1']).toMatchObject({
      type: 'layout',
      parentPath: '/main',
      children: ['/main/1/left'],
    });
    expect(records['/main/1/left']).toMatchObject({
      type: 'region',
      parentPath: '/main/1',
      children: ['/main/1/left/0'],
    });
    expect(records['/main/1/left/0']).toMatchObject({
      type: 'text',
      parentPath: '/main/1/left',
      empty: false,
    });
  });

  it('treats the fragment root component as the registry root path', () => {
    document.body.innerHTML = `
      <main>
        <div class="wrapper">
          <section data-portal-component-type="layout">
            <div data-portal-region="content">
              <article data-portal-component-type="part"></article>
            </div>
          </section>
        </div>
      </main>
    `;

    const records = parsePage(document.body, {fragment: true});

    expect(records['/']).toMatchObject({
      type: 'layout',
      parentPath: undefined,
      children: ['/content'],
    });
    expect(records['/content']).toMatchObject({
      type: 'region',
      parentPath: '/',
      children: ['/content/0'],
    });
    expect(records['/content/0']).toMatchObject({
      type: 'part',
      parentPath: '/content',
    });
  });

  it('returns an empty page record when fragment has no component', () => {
    document.body.innerHTML = '<main></main>';

    const records = parsePage(document.body, {fragment: true});

    expect(records['/']).toMatchObject({
      type: 'page',
      children: [],
      empty: true,
    });
  });

  it('marks empty regions', () => {
    document.body.innerHTML = `
      <section data-portal-region="main"></section>
    `;

    const records = parsePage(document.body);

    expect(records['/main']).toMatchObject({
      type: 'region',
      empty: true,
      children: [],
    });
  });

  it('detects error markers on components', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <div data-portal-component-type="part" data-portal-placeholder-error="true"></div>
      </section>
    `;

    const records = parsePage(document.body);

    expect(records['/main/0']).toMatchObject({
      type: 'part',
      error: true,
    });
  });

  it('resolves descriptors from the descriptor map', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <div data-portal-component-type="part"></div>
      </section>
    `;

    const records = parsePage(document.body, {
      descriptors: {'/main/0': {descriptor: 'com.app:my-part'}},
    });

    expect(records['/main/0'].descriptor).toBe('com.app:my-part');
  });

  it('falls back through fragment then name for descriptor resolution', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <div data-portal-component-type="part"></div>
        <div data-portal-component-type="text"></div>
      </section>
    `;

    const records = parsePage(document.body, {
      descriptors: {
        '/main/0': {fragment: 'abc-123'},
        '/main/1': {name: 'My Text'},
      },
    });

    expect(records['/main/0'].descriptor).toBe('abc-123');
    expect(records['/main/1'].descriptor).toBe('My Text');
  });

  it('returns undefined descriptor for page and region types', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <div data-portal-component-type="part"></div>
      </section>
    `;

    const records = parsePage(document.body, {
      descriptors: {
        '/': {descriptor: 'should-be-ignored'},
        '/main': {descriptor: 'also-ignored'},
      },
    });

    expect(records['/'].descriptor).toBeUndefined();
    expect(records['/main'].descriptor).toBeUndefined();
  });

  it('strips tracking attributes from descendants of a fragment component', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <div data-portal-component-type="fragment" id="frag">
          <div data-portal-region="inner">
            <article data-portal-component-type="part" id="inner-part"></article>
          </div>
        </div>
      </section>
    `;

    parsePage(document.body);

    const fragEl = document.getElementById('frag');
    const innerPart = document.getElementById('inner-part');
    const innerRegion = document.querySelector('[data-portal-region="inner"]');

    expect(fragEl?.getAttribute('data-portal-component-type')).toBe('fragment');
    expect(innerPart?.hasAttribute('data-portal-component-type')).toBe(false);
    expect(innerRegion).toBeNull();
  });

  it('preserves inner tracking attributes when the fragment root is a layout', () => {
    document.body.innerHTML = `
      <main>
        <section data-portal-component-type="layout">
          <div data-portal-region="content">
            <article data-portal-component-type="part" id="layout-part"></article>
          </div>
        </section>
      </main>
    `;

    parsePage(document.body, {fragment: true});

    const innerPart = document.getElementById('layout-part');
    const innerRegion = document.querySelector('[data-portal-region="content"]');

    expect(innerPart?.getAttribute('data-portal-component-type')).toBe('part');
    expect(innerRegion?.getAttribute('data-portal-region')).toBe('content');
  });

  it('registers a fragment as a leaf component with no children', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <div data-portal-component-type="fragment">
          <div data-portal-region="inner">
            <article data-portal-component-type="part"></article>
          </div>
        </div>
      </section>
    `;

    const records = parsePage(document.body);

    expect(records['/main/0']).toMatchObject({type: 'fragment', children: []});
    expect(records['/main/0/inner']).toBeUndefined();
    expect(records['/main/0/inner/0']).toBeUndefined();
  });
});
