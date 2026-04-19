import {useEffect, useRef} from 'preact/hooks';

import type {Meta, StoryObj} from '@storybook/preact-vite';
import type {JSX} from 'preact';

import {initPreview} from '../../src/preview';

//
// * Console spy — surfaces postMessage payloads in the browser devtools
//

function createLoggingWindow(label: string): Window {
  return {
    postMessage: (message: unknown): void => {
      // oxlint-disable-next-line no-console
      console.log(`[page-preview:${label}]`, message);
    },
  } as unknown as Window;
}

//
// * Theme tokens
//

const pageClass = 'relative flex w-[720px] flex-col bg-surface-primary text-main shadow-sm';
const headerClass = 'flex flex-col gap-1 border-b border-bdr-soft bg-surface-neutral px-8 py-6';
const titleClass = 'text-2xl font-semibold tracking-tight text-main';
const subtitleClass = 'text-sm text-subtle';
const mainClass = 'flex flex-col gap-3 px-8 py-8';
const labelClass = 'block text-xs font-semibold tracking-wide text-subtle uppercase';
const linkListClass = 'flex flex-col gap-2 text-sm';
const linkClass = 'text-link underline underline-offset-2 hover:opacity-80';
const hintClass = 'mt-6 rounded border border-bdr-soft bg-surface-info-soft px-3 py-2 text-xs text-subtle';

//
// * Demo page rendered inside "iframe body"
//

type PreviewPageProps = {
  hostDomain?: string;
  label: string;
};

function PreviewPage({hostDomain, label}: PreviewPageProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rootRef.current == null) return;

    const target = createLoggingWindow(label);
    const instance = initPreview(target, {hostDomain});

    return () => {
      instance.destroy();
    };
  }, [hostDomain, label]);

  return (
    <div ref={rootRef} data-testid='preview-page' className={pageClass}>
      <header className={headerClass}>
        <h1 className={titleClass}>Horizon</h1>
        <p className={subtitleClass}>Preview iframe — link clicks forward to the parent</p>
      </header>
      <main className={mainClass}>
        <span className={labelClass}>Navigation</span>
        <ul className={linkListClass}>
          <li>
            <a className={linkClass} href='/content/site/home'>
              Home
            </a>
          </li>
          <li>
            <a className={linkClass} href='/content/site/about'>
              About
            </a>
          </li>
          <li>
            <a className={linkClass} href='https://example.com/external'>
              External link
            </a>
          </li>
          <li>
            <a className={linkClass} href='#section'>
              Hash anchor (ignored)
            </a>
          </li>
        </ul>
        <p className={hintClass}>Open the browser console — each click logs the forwarded navigate message.</p>
      </main>
    </div>
  );
}

//
// * Meta
//

const meta = {
  title: 'Preview',
  parameters: {layout: 'fullscreen'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BasicPreview: Story = {
  name: 'Examples / Basic preview',
  render: () => (
    <div className='flex justify-center p-4'>
      <PreviewPage label='basic' />
    </div>
  ),
};

export const WithHostDomain: Story = {
  name: 'Features / With hostDomain',
  render: () => (
    <div className='flex justify-center p-4'>
      <PreviewPage label='with-host' hostDomain='https://example.com' />
    </div>
  ),
};
