import preactPreset from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {visualizer} from 'rollup-plugin-visualizer';
import dts from 'vite-plugin-dts';
import {defineConfig} from 'vite-plus';

// Loads the `test` augmentation onto vite-plus' UserConfig so the `test` block below typechecks.
import type {} from '@voidzero-dev/vite-plus-test/config';

// `vp` (oxc) loads this config as native ESM where `__dirname` is undefined.
const __dirname = path.dirname(fileURLToPath(import.meta.url)) ?? '';
const preactPath = path.join(__dirname, 'node_modules/preact');

const SRC_PATH = path.join(__dirname, 'src');
const OUT_PATH = path.join(__dirname, 'dist');

// Shared excludes for both oxlint (`lint.ignorePatterns`) and oxfmt (`fmt.ignorePatterns`).
// ! oxfmt only honors the local .gitignore, so agent/scratch dirs and the lockfile must be
// listed here explicitly — otherwise `vp check` walks into .claude/, .playwright-mcp/, etc.
const IGNORE_PATTERNS = [
    'node_modules/',
    'build/',
    'dist/',
    'coverage/',
    'reports/',
    'storybook-static/',
    // Leave CI workflow YAML to its own (2-space) convention; oxfmt would reindent
    // the bash inside `run:` blocks.
    '.github/',
    '.claude/',
    '.playwright-mcp/',
    '.tmp/',
    '.vite-hooks/',
    '.xp/',
    '.worktrees/',
    'pnpm-lock.yaml',
    '**/*.d.ts',
];

export default defineConfig(({mode}) => {
    const isProduction = mode === 'production';
    const isDevelopment = mode === 'development';

    return {
        root: SRC_PATH,
        base: './',

        build: {
            outDir: OUT_PATH,
            emptyOutDir: false,
            target: 'ES2023',
            minify: isProduction ? 'terser' : false,
            terserOptions: {
                // ! The page editor relies on class/function names at runtime, so identifiers
                //   must not be mangled — matches the previous esbuild `minifyIdentifiers: false`.
                mangle: false,
                compress: {
                    drop_console: true,
                    drop_debugger: true,
                },
                format: {
                    comments: false,
                },
            },
            // ! rolldown-vite minifies CSS with lightningcss, which rejects JS targets like
            //   `ES2023`. Pin esbuild (the previous Vite default) so the inlined `?inline`
            //   stylesheets keep minifying against `build.target`.
            cssMinify: isProduction ? 'esbuild' : false,
            sourcemap: isDevelopment,
            assetsInlineLimit: 2_000_000,
            lib: {
                entry: {
                    index: path.join(SRC_PATH, 'index.ts'),
                    'index.ssr': path.join(SRC_PATH, 'index.ssr.ts'),
                    protocol: path.join(SRC_PATH, 'protocol.ts'),
                },
                name: 'PageEditor',
                formats: ['es', 'cjs'],
                fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
            },
            ...(isProduction && {
                reportCompressedSize: true,
                chunkSizeWarningLimit: 1000,
            }),
            rollupOptions: {
                treeshake: true,
                onLog(level, log, defaultHandler) {
                    // ! @enonic/ui ships a prebuilt bundle whose `/* @__PURE__ */` hints sit where
                    //   Rolldown can't attach them. The annotations are harmless, so mute the noise.
                    //   Rolldown routes these through `onLog` (not `onwarn`) and omits `id`, so drop
                    //   the whole code.
                    if (log.code === 'INVALID_ANNOTATION') return;
                    defaultHandler(level, log);
                },
                output: {
                    chunkFileNames: 'js/chunks/[name]-[hash].js',
                    assetFileNames: '[name][extname]',
                    exports: 'auto',
                },
            },
        },
        plugins: [
            // Library build is always production: drop prefresh HMR and strip the devtools/
            // hook-name plugins the preset always wires in — they inject nothing without an
            // HTML entry but still run on every module.
            ...preactPreset({prefreshEnabled: false, devToolsEnabled: false}).filter(
                p => p.name !== 'preact:devtools' && p.name !== 'preact:transform-hook-names',
            ),
            tailwindcss(),
            dts({
                tsconfigPath: path.join(__dirname, 'tsconfig.app.json'),
                bundleTypes: true,
                entryRoot: SRC_PATH,
                // ! Force the ambient `src/types.d.ts` (which declares `*.css?inline`) into the
                //   dts program — unplugin-dts builds from the entry graph, not the tsconfig
                //   include globs, so an un-imported ambient file is otherwise dropped.
                include: [`${SRC_PATH}/**/*.ts`, `${SRC_PATH}/**/*.tsx`],
                exclude: ['**/*.test.ts', '**/*.test.tsx', '**/test/**', '.storybook/**/*'],
            }),
            visualizer({
                // ! Keep the report out of `dist/` so the `files: ["dist"]` allowlist never ships it.
                filename: path.join(__dirname, 'reports/stats.html'),
                open: false,
                gzipSize: true,
                brotliSize: true,
            }),
        ],
        resolve: {
            alias: {
                react: path.join(preactPath, 'compat'),
                'react-dom': path.join(preactPath, 'compat'),
                'react/jsx-runtime': path.join(preactPath, 'jsx-runtime'),
                'react/jsx-dev-runtime': path.join(preactPath, 'jsx-dev-runtime'),
            },
            // ! Pinning every Preact entry to this project's node_modules keeps a
            //   single instance when `@enonic/ui` is consumed via a `link:` override
            //   (the linked package ships its own Preact). Two Preacts break hooks
            //   with `TypeError: can't access property "__H", … is undefined`.
            dedupe: ['preact', 'preact/compat', 'preact/hooks', 'preact/jsx-runtime', 'preact/jsx-dev-runtime'],
            extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
        test: {
            environment: 'jsdom',
            globals: true,
            include: ['**/*.test.{ts,tsx}'],
            setupFiles: ['test/vitest.setup.ts'],
            server: {
                // ! @enonic/ui's ESM bundle does `import {createPortal} from 'react'`.
                // ! Inlining routes its module through the transform pipeline where
                // ! resolve.alias (react -> preact/compat) applies — without this,
                // ! Node ESM loads the real CJS react and the named export fails.
                deps: {
                    inline: ['@enonic/ui'],
                },
            },
        },
        lint: {
            plugins: ['oxc', 'typescript', 'unicorn', 'react', 'import', 'jsx-a11y'],
            categories: {
                correctness: 'error',
            },
            options: {
                typeAware: true,
                typeCheck: true,
            },
            env: {
                builtin: true,
                es2024: true,
            },
            ignorePatterns: IGNORE_PATTERNS,
            rules: {
                'no-unused-vars': [
                    'error',
                    {
                        args: 'all',
                        argsIgnorePattern: '^_',
                        caughtErrors: 'all',
                        caughtErrorsIgnorePattern: '^_',
                        destructuredArrayIgnorePattern: '^_',
                        varsIgnorePattern: '^_',
                        ignoreRestSiblings: true,
                    },
                ],
                'typescript/restrict-template-expressions': ['error', {allowNumber: true}],
                // Off: every hit is an intentional ARIA role on an unstyled widget, not a native-tag candidate.
                'jsx-a11y/prefer-tag-over-role': 'off',
                // Off: the editor renders mouse-driven chrome (full-page shader, drag handles) as
                // non-semantic interactive layers; keyboard/role semantics don't apply to these overlays.
                'jsx-a11y/click-events-have-key-events': 'off',
                'jsx-a11y/no-static-element-interactions': 'off',

                // Allow intentional diagnostics (`warn`/`error`); still flag stray `log`/`debug`/`info`.
                // All console output is stripped from the production build via terser `drop_console`.
                'no-console': ['warn', {allow: ['warn', 'error']}],
                'no-empty': 'error',
                'no-empty-function': 'error',
                'no-regex-spaces': 'error',
                'no-use-before-define': ['error', {functions: false, classes: true}],
                'no-var': 'error',
                'prefer-const': 'error',
                'prefer-rest-params': 'error',
                'prefer-spread': 'error',
                // Allow-list Preact's non-standard DOM props instead of disabling the rule.
                'react/no-unknown-property': ['error', {ignore: ['onDblClick']}],
                'typescript/explicit-function-return-type': [
                    'error',
                    {allowExpressions: true, allowConciseArrowFunctionExpressionsStartingWithVoid: true},
                ],
                'typescript/no-empty-object-type': 'error',
                'typescript/no-explicit-any': 'error',
                'typescript/no-invalid-void-type': 'error',
                'typescript/no-namespace': 'error',
                'typescript/no-non-null-asserted-nullish-coalescing': 'error',
                'typescript/no-require-imports': 'error',
                'typescript/prefer-literal-enum-member': 'error',
                'typescript/use-unknown-in-catch-callback-variable': 'error',

                'no-unexpected-multiline': 'error',
                'no-useless-constructor': 'error',
                'import/no-named-as-default': 'error',
                'import/no-named-as-default-member': 'error',
                // Forbid barrel-import cycles that break Rollup chunking.
                'import/no-cycle': 'error',
                'react/jsx-no-comment-textnodes': 'error',
                'typescript/no-confusing-non-null-assertion': 'error',
                // Off: page-editor exposes static-class APIs by design (`PageEditor`, `StringHelper`,
                // `ObjectHelper`, `UriHelper`, `assert`); collapsing them to bare functions isn't wanted.
                'typescript/no-extraneous-class': 'off',
                'typescript/no-unnecessary-boolean-literal-compare': 'error',
                'typescript/no-unnecessary-template-expression': 'error',
                'typescript/no-unnecessary-type-arguments': 'warn',
                'typescript/no-unnecessary-type-assertion': 'error',
                'typescript/no-unnecessary-type-constraint': 'error',
                'typescript/no-unsafe-enum-comparison': 'error',

                'no-array-constructor': 'error',
                'no-case-declarations': 'error',
                'no-fallthrough': 'error',
                'no-prototype-builtins': 'error',
                'no-redeclare': 'error',
                'react/display-name': 'error',
                'react/jsx-no-target-blank': 'error',
                'react/no-unescaped-entities': 'error',
                'react/rules-of-hooks': 'error',
                'typescript/ban-ts-comment': ['error', {minimumDescriptionLength: 10}],
                'typescript/no-confusing-void-expression': [
                    'error',
                    {ignoreArrowShorthand: true, ignoreVoidOperator: true},
                ],
                'typescript/no-mixed-enums': 'error',

                // Off: react and react-dom both alias to preact/compat, so the resolver false-flags dual imports.
                'import/no-duplicates': 'off',
                'typescript/adjacent-overload-signatures': 'error',
                'typescript/ban-tslint-comment': 'error',
                'typescript/class-literal-property-style': 'off',
                'typescript/consistent-generic-constructors': 'error',
                'typescript/consistent-indexed-object-style': 'error',
                'typescript/consistent-type-assertions': 'error',
                'typescript/no-inferrable-types': 'off',
                'typescript/prefer-find': 'error',
                'typescript/prefer-for-of': 'error',
                'typescript/prefer-function-type': 'error',
                'typescript/prefer-regexp-exec': 'error',
                'typescript/prefer-return-this-type': 'error',
                'typescript/prefer-string-starts-ends-with': 'error',
                'typescript/unified-signatures': 'error',
            },
            overrides: [
                {
                    files: ['**/*.test.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
                    rules: {
                        'typescript/explicit-function-return-type': 'off',
                        'typescript/no-explicit-any': 'off',
                        'no-console': 'off',
                        // `vi.mocked(obj.method)` and empty mock callbacks are idiomatic in tests.
                        'typescript/unbound-method': 'off',
                        'no-empty-function': 'off',
                    },
                },
                {
                    files: ['**/*.stories.tsx', '.storybook/**/*.{ts,tsx}'],
                    rules: {
                        'react/display-name': 'off',
                        'typescript/explicit-function-return-type': 'off',
                        // Storybook `render`/`play` arrows call hooks but aren't statically recognized as components.
                        'react/rules-of-hooks': 'off',
                        // Demo handlers log freely; console is dropped from the library build.
                        'no-console': 'off',
                        // Demo style objects spread helper return values into inline `style`.
                        'typescript/no-misused-spread': 'off',
                    },
                },
                {
                    files: ['*.config.ts', '*.config.*.ts'],
                    rules: {
                        'typescript/explicit-function-return-type': 'off',
                    },
                },
            ],
        },
        fmt: {
            ignorePatterns: IGNORE_PATTERNS,
            // Keep this repo's established 4-space indentation and `{x}` import style
            // (see .zed/settings.json); everything else follows the @enonic/ui formatter.
            tabWidth: 4,
            printWidth: 120,
            semi: true,
            trailingComma: 'all',
            singleQuote: true,
            arrowParens: 'avoid',
            bracketSpacing: false,
            jsxSingleQuote: true,
            sortImports: {
                newlinesBetween: true,
                customGroups: [{groupName: 'css', elementNamePattern: ['*.css', '*.scss', '*.sass']}],
                groups: [
                    ['value-builtin', 'value-external'],
                    'value-internal',
                    'type-import',
                    ['value-parent', 'value-sibling', 'value-index'],
                    'css',
                    'unknown',
                ],
            },
            sortPackageJson: false,
        },
        staged: {
            '*': 'vp check --fix',
        },
        ...(isDevelopment && {
            server: {
                open: false,
                hmr: true,
            },
            clearScreen: false,
        }),
        ...(isProduction && {
            logLevel: 'warn',
        }),
    };
});
