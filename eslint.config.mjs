import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import perfectionist from 'eslint-plugin-perfectionist'
import hooksPlugin from 'eslint-plugin-react-hooks'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'

import { noHardcodedHexColor } from './scripts/eslint-rules/no-hardcoded-hex-color.mjs'
import { noNumericBorderRadius } from './scripts/eslint-rules/no-numeric-border-radius.mjs'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/package-lock.json',
      'android/**',
      'ios/**',
      '.expo/**',
      // Static HTML/CSS/JS prototype mockups (D15.3, D16), not app source.
      'docs/desktop-prototypes/**',
      'docs/mobile-prototypes/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      perfectionist,
      'react-hooks': hooksPlugin,
      'unused-imports': unusedImports
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': 'off',
      curly: ['error', 'all'],
      'no-fallthrough': ['error', { allowEmptyCase: true }],
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'padding-line-between-statements': [
        1,
        {
          blankLine: 'always',
          next: [
            'block-like',
            'block',
            'return',
            'if',
            'class',
            'continue',
            'debugger',
            'break',
            'multiline-const',
            'multiline-let'
          ],
          prev: '*'
        },
        {
          blankLine: 'always',
          next: '*',
          prev: ['case', 'default', 'multiline-const', 'multiline-let', 'multiline-block-like']
        },
        { blankLine: 'never', next: ['block', 'block-like'], prev: ['case', 'default'] },
        { blankLine: 'always', next: ['block', 'block-like'], prev: ['block', 'block-like'] },
        { blankLine: 'always', next: ['empty'], prev: 'export' },
        { blankLine: 'never', next: 'iife', prev: ['block', 'block-like', 'empty'] }
      ],
      'perfectionist/sort-exports': ['error', { order: 'asc', type: 'natural' }],
      'perfectionist/sort-imports': [
        'error',
        {
          groups: ['side-effect', 'builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          order: 'asc',
          type: 'natural'
        }
      ],
      'perfectionist/sort-jsx-props': ['error', { order: 'asc', type: 'natural' }],
      'perfectionist/sort-named-exports': ['error', { order: 'asc', type: 'natural' }],
      'perfectionist/sort-named-imports': ['error', { order: 'asc', type: 'natural' }],
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'unused-imports/no-unused-imports': 'error'
    }
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ignores: ['**/node_modules/**', '**/dist/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node },
      sourceType: 'module'
    }
  },
  {
    files: ['src/upstream/**/*.{ts,tsx}', 'src/gateway/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { message: 'This module is vendored/gateway code; it must not touch browser globals.', name: 'window' },
        { message: 'This module is vendored/gateway code; it must not touch browser globals.', name: 'document' },
        {
          message: 'This module is vendored/gateway code; it must not touch browser globals.',
          name: 'localStorage'
        },
        { message: 'This module is vendored/gateway code; it must not touch browser globals.', name: 'navigator' }
      ]
    }
  },
  {
    // app.config.ts configures native build-time resources (splash screen,
    // notification icon tint) that exist before any JS runs and can never
    // read useTheme() — not a themed UI file, so it's exempt the same way
    // src/theme/** and src/upstream/** are.
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/theme/**', 'src/upstream/**', 'app.config.ts'],
    plugins: {
      local: {
        rules: { 'no-hardcoded-hex-color': noHardcodedHexColor, 'no-numeric-border-radius': noNumericBorderRadius }
      }
    },
    rules: {
      // M13 (D14) Step 5's sweep is done — every hard-coded hex literal
      // outside src/theme/** and src/upstream/** is gone (the one
      // legitimate exception, a project's own user-picked rail colour in
      // src/api/projects.test.ts, is inline-disabled with a reason).
      'local/no-hardcoded-hex-color': 'error',
      // D15.1b: every borderRadius outside src/theme/** is a radius.* token.
      'local/no-numeric-border-radius': 'error'
    }
  }
]
