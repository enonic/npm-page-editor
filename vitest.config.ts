import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['src/main/resources/assets/js/**/*.test.ts', 'src/main/resources/assets/js/**/*.test.tsx'],
        setupFiles: ['src/main/resources/assets/js/test/vitest.setup.ts'],
    },
    resolve: {
        alias: {
            '@enonic/lib-admin-ui': path.join(__dirname, '.xp/dev/lib-admin-ui'),
            '@enonic/lib-contentstudio': path.join(__dirname, '.xp/dev/lib-contentstudio'),
            'react': 'preact/compat',
            'react-dom': 'preact/compat',
            'react/jsx-runtime': 'preact/jsx-runtime',
            'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'preact',
    },
});
