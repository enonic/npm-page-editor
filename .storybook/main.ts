import tailwindcss from '@tailwindcss/vite';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import type {StorybookConfig} from '@storybook/preact-vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preactPath = path.resolve(__dirname, '../node_modules/preact');

// ? @storybook/preact exposes `resolvedReact.reactDom` as a bare `preact/compat`,
//   which makes the react-dom-shim preset fall back to the legacy `react-16` entry
//   and alias `@storybook/react-dom-shim` to another bare specifier (triggers a
//   Vite warning and blocks dep optimization). Preact 10.29 exposes `createRoot`
//   via `preact/compat/client`, so point the shim at the modern react-18 entry and
//   alias `react-dom/client` to `preact/compat/client`.
const storybookRequire = createRequire(import.meta.resolve('@storybook/preact-vite/package.json'));
const reactDomShimPath = storybookRequire.resolve('@storybook/react-dom-shim');

const config: StorybookConfig = {
  stories: ['../.storybook/stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-themes'],
  framework: '@storybook/preact-vite',
  core: {
    disableWhatsNewNotifications: true,
  },
  features: {
    sidebarOnboardingChecklist: false,
  },
  viteFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      '@storybook/react-dom-shim': reactDomShimPath,
      react: path.join(preactPath, 'compat'),
      'react-dom/client': path.join(preactPath, 'compat/client'),
      'react-dom': path.join(preactPath, 'compat'),
      'react/jsx-runtime': path.join(preactPath, 'jsx-runtime'),
      'react/jsx-dev-runtime': path.join(preactPath, 'jsx-dev-runtime'),
    };
    config.resolve.dedupe = [
      ...(config.resolve.dedupe ?? []),
      'preact',
      'preact/compat',
      'preact/hooks',
      'preact/jsx-runtime',
    ];

    config.optimizeDeps ??= {};
    config.optimizeDeps.include = [
      ...(config.optimizeDeps.include ?? []),
      'preact',
      'preact/hooks',
      'preact/compat',
      '@enonic/ui',
    ];

    config.oxc = {
      ...config.oxc,
      jsx: {
        runtime: 'automatic',
        importSource: 'preact',
      },
    };

    config.plugins = (config.plugins ?? []).flat().filter(plugin => {
      if (plugin == null || plugin === false) return false;
      if (typeof plugin !== 'object') return true;
      return !('name' in plugin) || plugin.name !== 'vite:dts';
    });
    config.plugins.push(tailwindcss());

    return config;
  },
};

export default config;
