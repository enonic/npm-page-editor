import inject from '@rollup/plugin-inject';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';
import dts from 'vite-plugin-dts';

const __dirname = path.dirname(fileURLToPath(import.meta.url)) ?? '';

export default defineConfig(({mode}) => {
    const isProduction = mode === 'production';
    const isDevelopment = mode === 'development';

    const IN_PATH = path.join(__dirname, 'src/main/resources/assets');
    const OUT_PATH = path.join(__dirname, 'build/resources/main/assets');

    return {
        root: IN_PATH,
        base: './',

        build: {
            outDir: OUT_PATH,
            emptyOutDir: false,
            target: 'ES2023',
            minify: isProduction,
            sourcemap: isDevelopment,
            assetsInlineLimit: 2_000_000,
            lib: {
                entry: path.join(IN_PATH, 'js/index.ts'),
                name: 'PageEditor',
                formats: ['es', 'cjs'],
                fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`
            },
            ...(isProduction && {
                reportCompressedSize: true,
                chunkSizeWarningLimit: 1000
            }),
            rollupOptions: {
                treeshake: true,
                plugins: [
                    inject({
                        $: 'jquery',
                        jQuery: 'jquery',
                    })
                ],
                output: {
                    chunkFileNames: 'js/chunks/[name]-[hash].js',
                    assetFileNames: '[name][extname]',
                    exports: 'auto',
                    ...(isProduction && {
                        compact: true,
                        generatedCode: {
                            constBindings: true
                        }
                    })
                }
            }
        },
        plugins: [
            tailwindcss(),
            dts({
                root: OUT_PATH,
                rollupTypes: true,
                aliasesExclude: ['@enonic/lib-admin-ui', '@enonic/lib-contentstudio'],
                bundledPackages: ['@enonic/lib-admin-ui', '@enonic/lib-contentstudio'],
            })
        ],
        esbuild: {
            jsx: 'automatic',
            jsxImportSource: 'preact',
            minifyIdentifiers: false,
            keepNames: true,
            treeShaking: true,
            ...(isProduction && {
                drop: ['console', 'debugger'],
                legalComments: 'none'
            })
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
            extensions: ['.ts', '.tsx', '.js', '.jsx']
        },
        ...(isDevelopment && {
            server: {
                open: false,
                hmr: true
            },
            clearScreen: false
        }),
        ...(isProduction && {
            logLevel: 'warn'
        })
    };
});
