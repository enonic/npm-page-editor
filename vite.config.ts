import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dts from 'vite-plugin-dts';
import {defineConfig} from 'vite-plus';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SHARED_IGNORES = [
  'node_modules/',
  'dist/',
  'build/',
  'storybook-static/',
  'coverage/',
  'reports/',
  'docs/',
  '.claude/',
  '.github/',
  '**/*.d.ts',
];

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  lint: {
    plugins: ['oxc', 'typescript', 'unicorn', 'react', 'import', 'jsx-a11y', 'vitest'],
    categories: {
      correctness: 'error',
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    env: {
      browser: true,
      es2024: true,
    },
    ignorePatterns: SHARED_IGNORES,
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

      'react/exhaustive-deps': 'error',
      'jsx-a11y/prefer-tag-over-role': 'warn',

      'no-console': 'warn',
      'no-empty': 'error',
      'no-empty-function': 'error',
      'no-var': 'error',
      'no-use-before-define': ['error', {functions: false, classes: true}],
      'react/no-unknown-property': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/no-invalid-void-type': 'error',
      'typescript/no-namespace': 'error',
      'typescript/no-non-null-assertion': 'error',
      'typescript/no-non-null-asserted-nullish-coalescing': 'error',
      'typescript/no-require-imports': 'error',
      'typescript/no-empty-object-type': 'error',
      'typescript/prefer-literal-enum-member': 'error',
      'typescript/use-unknown-in-catch-callback-variable': 'error',
      'typescript/explicit-function-return-type': [
        'error',
        {allowExpressions: true, allowConciseArrowFunctionExpressionsStartingWithVoid: true},
      ],

      'no-unexpected-multiline': 'error',
      'no-useless-constructor': 'error',
      'import/no-named-as-default': 'error',
      'import/no-named-as-default-member': 'error',
      'react/jsx-no-comment-textnodes': 'error',
      'typescript/no-confusing-non-null-assertion': 'error',
      'typescript/no-extraneous-class': 'error',
      'typescript/no-unnecessary-boolean-literal-compare': 'error',
      'typescript/no-unnecessary-template-expression': 'error',
      'typescript/no-unnecessary-type-arguments': 'error',
      'typescript/no-unnecessary-type-assertion': 'error',
      'typescript/no-unnecessary-type-constraint': 'error',
      'typescript/no-unsafe-enum-comparison': 'error',

      'react/display-name': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/no-unescaped-entities': 'error',
      'react/rules-of-hooks': 'error',
      'typescript/ban-ts-comment': ['error', {minimumDescriptionLength: 10}],
      'typescript/no-confusing-void-expression': ['error', {ignoreArrowShorthand: true, ignoreVoidOperator: true}],
      'typescript/no-deprecated': 'error',
      'typescript/no-misused-promises': 'error',
      'typescript/no-mixed-enums': 'error',
      'typescript/no-unsafe-argument': 'error',
      'typescript/no-unsafe-assignment': 'error',
      'typescript/no-unsafe-call': 'error',
      'typescript/no-unsafe-function-type': 'error',
      'typescript/no-unsafe-member-access': 'error',
      'typescript/no-unsafe-return': 'error',
      'typescript/only-throw-error': 'error',
      'typescript/prefer-nullish-coalescing': 'error',
      'typescript/prefer-promise-reject-errors': 'error',
      'typescript/require-await': 'error',
      'typescript/restrict-plus-operands': [
        'error',
        {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
      ],
      'typescript/return-await': ['error', 'error-handling-correctness-only'],

      'import/no-duplicates': 'error',
      'typescript/array-type': 'error',
      'typescript/consistent-type-assertions': 'error',
      'typescript/consistent-type-definitions': ['error', 'type'],
      'typescript/consistent-type-imports': ['error', {prefer: 'type-imports', fixStyle: 'inline-type-imports'}],
      'typescript/prefer-find': 'error',
      'typescript/prefer-for-of': 'error',
      'typescript/prefer-function-type': 'error',
      'typescript/prefer-regexp-exec': 'error',
    },
    overrides: [
      {
        files: ['**/*.test.ts', '**/*.test.tsx'],
        rules: {
          'no-console': 'off',
          'vitest/consistent-vitest-vi': 'error',
          'vitest/no-conditional-tests': 'error',
          'vitest/no-importing-vitest-globals': 'error',
        },
      },
    ],
  },
  fmt: {
    printWidth: 120,
    semi: true,
    trailingComma: 'all',
    singleQuote: true,
    arrowParens: 'avoid',
    bracketSpacing: false,
    jsxSingleQuote: true,
    experimentalTailwindcss: {
      stylesheet: './src/rendering/editor-ui.css',
      attributes: ['class', 'className'],
      functions: ['cn'],
      preserveDuplicates: false,
      preserveWhitespace: false,
    },
    sortImports: {
      newlinesBetween: true,
      customGroups: [{groupName: 'css', elementNamePattern: ['*.css', '*.scss', '*.less']}],
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
    ignorePatterns: SHARED_IGNORES,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
    restoreMocks: true,
    passWithNoTests: true,
  },
  plugins: [
    tailwindcss(),
    dts({
      outDir: 'dist/types',
      tsconfigPath: './tsconfig.app.json',
      aliasesExclude: ['react', 'react-dom'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '.storybook/**/*'],
      logLevel: 'warn',
    }),
  ],
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'preact',
      // Not yet implemented
      // keepNames: true,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    cssCodeSplit: false,
    cssMinify: true,
    assetsInlineLimit: 2_000_000,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'PageEditor',
      formats: ['es', 'cjs'],
      fileName: format => (format === 'cjs' ? 'index.cjs' : 'index.js'),
      cssFileName: 'main',
    },
    rollupOptions: {
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: '[name][extname]',
        exports: 'auto',
      },
    },
  },
});
