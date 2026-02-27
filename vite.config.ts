import inject from '@rollup/plugin-inject';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import path from 'path';
import postcssNormalize from 'postcss-normalize';
import postcssSortMediaQueries from 'postcss-sort-media-queries';
import {fileURLToPath} from 'url';
import {defineConfig, type UserConfig} from 'vite';
import dts from 'vite-plugin-dts';

const allowedTargets = ['js', 'css'] as const;
type BuildTarget = (typeof allowedTargets)[number];

const isBuildTarget = (target: string | undefined): target is BuildTarget => {
    return allowedTargets.includes(target as BuildTarget);
};

const __dirname = path.dirname(fileURLToPath(import.meta.url)) ?? '';

export default defineConfig(({mode}) => {
    const {BUILD_TARGET} = process.env;
    const target = isBuildTarget(BUILD_TARGET) ? BUILD_TARGET : 'js';

    const isProduction = mode === 'production';
    const isDevelopment = mode === 'development';

    const IN_PATH = path.join(__dirname, 'src/main/resources/assets');
    const OUT_PATH = path.join(__dirname, 'build/resources/main/assets');

    const CONFIGS: Record<BuildTarget, UserConfig> = {
        js: {
            root: IN_PATH,
            base: './',

            build: {
                outDir: OUT_PATH,
                emptyOutDir: false,
                target: 'ES2023',
                minify: isProduction,
                sourcemap: isDevelopment,
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
                    },
                    external: [
                        'jquery',
                    ]
                }
            },
            plugins: [
                dts({
                    root: OUT_PATH,
                    rollupTypes: true,
                    aliasesExclude: ['@enonic/lib-admin-ui', '@enonic/lib-contentstudio'],
                    bundledPackages: ['@enonic/lib-admin-ui', '@enonic/lib-contentstudio'],
                })
            ],
            esbuild: {
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
                    '~enonic-admin-artifacts': 'enonic-admin-artifacts/index.less'
                },
                extensions: ['.ts', '.js']
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
        },
        css: {
            root: IN_PATH,
            base: './',
            build: {
                outDir: OUT_PATH,
                emptyOutDir: false,
                minify: isProduction,
                sourcemap: isDevelopment,
                rollupOptions: {
                    input: {
                        'main': path.join(IN_PATH, 'css/main.less'),
                    },
                    output: {
                        assetFileNames: (assetInfo) => {
                            const assetName = assetInfo.names?.[0] ?? '';
                            if (assetName.endsWith('.css')) {
                                const name = assetName.replace(/\.(less|css)$/, '');
                                return `${name}.css`;
                            }
                            if (/\.(svg|png|jpg|gif)$/.test(assetName)) {
                                return 'images/[name][extname]';
                            }
                            if (/\.(woff|woff2|ttf|eot)$/.test(assetName)) {

                                return 'fonts/[name][extname]';
                            }
                            return '[name][extname]';
                        }
                    }
                }
            },
            resolve: {
                alias: {
                    '@enonic/lib-admin-ui': path.join(__dirname, '.xp/dev/lib-admin-ui'),
                    '@enonic/lib-contentstudio': path.join(__dirname, '.xp/dev/lib-contentstudio'),
                    '~enonic-admin-artifacts': 'enonic-admin-artifacts/index.less'
                },
                extensions: ['.less', '.css']
            },
            css: {
                preprocessorOptions: {
                    less: {
                        javascriptEnabled: true
                    }
                },
                postcss: {
                    plugins: [
                        postcssNormalize(),
                        autoprefixer(),
                        postcssSortMediaQueries({sort: 'desktop-first'}),
                        ...(isProduction ? [cssnano({preset: ['default', {normalizeUrl: false}]})] : [])
                    ]
                }
            }
        }
    };

    return CONFIGS[target];
});
