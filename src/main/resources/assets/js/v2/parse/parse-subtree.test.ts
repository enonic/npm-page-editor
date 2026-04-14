import type {ComponentPath} from '../protocol';

import {fromString} from '../protocol';
import {parseSubtree} from './parse-subtree';

function path(raw: string): ComponentPath {
  const result = fromString(raw);
  if (!result.ok) throw new Error(`Invalid path: ${raw}`);
  return result.value;
}

describe('parseSubtree', () => {
  it('parses only a region subtree without rebuilding the full page registry', () => {
    document.body.innerHTML = `
      <main>
        <section data-portal-region="main">
          <article data-portal-component-type="part"></article>
          <section data-portal-component-type="layout">
            <div data-portal-region="left">
              <div data-portal-component-type="text">Body</div>
            </div>
          </section>
        </section>
        <section data-portal-region="aside">
          <article data-portal-component-type="part"></article>
        </section>
      </main>
    `;

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    const records = parseSubtree(region, path('/main'));

    expect(Object.keys(records)).toEqual(['/main/0', '/main/1/left/0', '/main/1/left', '/main/1', '/main']);
    expect(records['/main']).toMatchObject({
      type: 'region',
      children: ['/main/0', '/main/1'],
    });
    expect(records['/main/1']).toMatchObject({
      type: 'layout',
      children: ['/main/1/left'],
    });
  });

  it('parses a component subtree and preserves descendant paths', () => {
    document.body.innerHTML = `
      <main>
        <section data-portal-region="main">
          <section data-portal-component-type="layout">
            <div data-portal-region="left">
              <div data-portal-component-type="text">Body</div>
            </div>
          </section>
        </section>
      </main>
    `;

    const component = document.querySelector('[data-portal-component-type="layout"]') as HTMLElement;
    const records = parseSubtree(component, path('/main/0'));

    expect(records['/main/0']).toMatchObject({
      type: 'layout',
      children: ['/main/0/left'],
    });
    expect(records['/main/0/left/0']).toMatchObject({
      type: 'text',
      parentPath: '/main/0/left',
    });
    expect(records['/']).toBeUndefined();
  });

  it('delegates to parsePage for root path', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <div data-portal-component-type="part"></div>
      </section>
    `;

    const records = parseSubtree(document.body, path('/'));

    expect(records['/']).toMatchObject({
      type: 'page',
      children: ['/main'],
    });
  });

  it('threads descriptors through to parsed records', () => {
    document.body.innerHTML = `
      <section data-portal-region="main">
        <div data-portal-component-type="part"></div>
      </section>
    `;

    const region = document.querySelector('[data-portal-region="main"]') as HTMLElement;
    const records = parseSubtree(region, path('/main'), {
      descriptors: {'/main/0': {descriptor: 'com.app:my-part'}},
    });

    expect(records['/main/0'].descriptor).toBe('com.app:my-part');
  });
});
