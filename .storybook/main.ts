import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {StorybookConfig} from '@storybook/preact-vite';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preactPath = path.resolve(__dirname, '../node_modules/preact');

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
            ...(config.esbuild ?? {}),
            jsx: 'automatic',
            jsxImportSource: 'preact',
        };

        config.plugins = (config.plugins ?? [])
            .flat()
            .filter((plugin) => Boolean(plugin) && (!('name' in plugin) || plugin.name !== 'vite:dts'));
        config.plugins.push(tailwindcss());

        return config;
    },
};

export default config;
