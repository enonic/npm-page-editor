import eslint from '@eslint/js';
import {defineConfig, globalIgnores} from 'eslint/config'
import tsEslint from 'typescript-eslint';

const eslintConfig = defineConfig([
    eslint.configs.recommended,
    tsEslint.configs.recommended,
    {
        "rules": {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["error", {
                "args": "all",
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }],
            "no-prototype-builtins": "off",
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                    fixStyle: 'inline-type-imports'
                }
            ]
        }
    },
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        "*.config.ts",
        "build/**/*",
        "dist/**/*",
        "node_modules/**/*",
        "**/.xp/**/*",
        "**/*.js",
        "**/*.d.ts",
        "**/spec/**/*"
    ])
])

export default eslintConfig;
