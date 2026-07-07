import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import type {StorybookConfig} from '@storybook/preact-vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preactPath = path.resolve(__dirname, '../node_modules/preact');

const config: StorybookConfig = {
    stories: ['../.storybook/page-editor/**/*.stories.@(ts|tsx)'],
    addons: ['@storybook/addon-docs', '@storybook/addon-themes'],
    framework: '@storybook/preact-vite',
    viteFinal(config) {
        config.resolve ??= {};
        config.resolve.alias = {
            ...(config.resolve.alias as Record<string, string>),
            react: path.join(preactPath, 'compat'),
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

        config.esbuild = {
            ...config.esbuild,
            jsx: 'automatic',
            jsxImportSource: 'preact',
        };

        config.build ??= {};
        // rolldown-vite minifies CSS with lightningcss, which rejects JS targets like ES2023.
        // Pin esbuild here too so the Storybook preview build matches vite.config.ts.
        config.build.cssMinify = 'esbuild';

        config.plugins = (config.plugins ?? []).flat().filter(plugin => {
            if (!plugin || typeof plugin !== 'object' || !('name' in plugin)) {
                return Boolean(plugin);
            }
            // The library build emits declarations; Storybook's preview build does not need them.
            // vite-plugin-dts 5.x renamed its plugin from `vite:dts` to `unplugin-dts`.
            return plugin.name !== 'unplugin-dts' && plugin.name !== 'vite:dts';
        });
        config.plugins.push(tailwindcss());

        return config;
    },
};

export default config;
