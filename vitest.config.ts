import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['src/main/resources/assets/js/**/*.test.ts', 'src/main/resources/assets/js/**/*.test.tsx'],
    },
    resolve: {
        alias: {
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
