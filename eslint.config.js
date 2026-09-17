// Flat config, replacing the old `.eslintrc.cjs`.
//
// The .eslintrc file had been dead for a long time: ESLint 10 only reads
// `eslint.config.*`, so every `npx eslint src/...` exited with "couldn't find
// an eslint.config.* file" and nobody noticed the linter was never running.
//
// That is not a cosmetic gap. src/components/living/SoloPeople.jsx called
// `useEffect` while importing only `{ useMemo, useState }`, which threw
// `ReferenceError: useEffect is not defined` on first render and put the
// দেনা-পাওনা page behind the error boundary on real devices. `no-undef` flags
// that in milliseconds. So the two rules this config exists to guarantee are
// `no-undef` and `react-hooks/rules-of-hooks`; everything else is secondary.

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    // .gitignore already excludes these; linting build output or the Android
    // shell would bury real findings under thousands of generated-code errors.
    ignores: [
      'dist/**',
      'android/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      'src/dev/**',
      'src/test/**',
      '**/*.test.js',
      '**/*.test.jsx',
      '**/*.spec.js',
      '**/*.spec.jsx',
    ],
  },

  js.configs.recommended,
  react.configs.flat.recommended,
  // vite.config.js uses `react()` with default options, i.e. the automatic JSX
  // runtime — React does not need to be in scope to use JSX. Without this,
  // `react/react-in-jsx-scope` errors on every file that (correctly) omits the
  // React import.
  react.configs.flat['jsx-runtime'],

  {
    files: ['**/*.{js,jsx}'],

    languageOptions: {
      // Was `parserOptions: { ecmaVersion: 12, sourceType: 'module' }` —
      // ecmaVersion 12 is ES2021.
      ecmaVersion: 2021,
      sourceType: 'module',
      // Was `env: { browser: true, es2021: true }`. This is what makes
      // `no-undef` usable: without it every `window`, `document`, `fetch` and
      // `localStorage` is an undefined variable and the rule has to be turned
      // off, which is how `useEffect is not defined` ships to production.
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },

    plugins: {
      'react-hooks': reactHooks,
    },

    settings: {
      // Pinned, not 'detect'. eslint-plugin-react's auto-detection calls
      // `context.getFilename()`, which ESLint 10 removed, so 'detect' crashes
      // the run outright with "contextOrFilename.getFilename is not a
      // function". Bump this when React is upgraded.
      react: { version: '18.3' },
    },

    rules: {
      ...reactHooks.configs.recommended.rules,

      // Carried over verbatim from .eslintrc.cjs.
      'no-undef': 'error',
      'no-use-before-define': 'error',

      // The two rules this config exists for. Stated explicitly so a future
      // edit to the spread above cannot silently downgrade them.
      'react-hooks/rules-of-hooks': 'error',

      // ---------------------------------------------------------------------
      // Noise control.
      //
      // This is a large codebase that has never been linted, so the rules below
      // have thousands of pre-existing violations. Left at "error" they make
      // `npm run lint` exit non-zero no matter what, which trains everyone to
      // ignore it — and a genuine `no-undef` scrolls past in the flood.
      //
      // They are warnings, not "off": still reported, still fixable
      // incrementally, but a red error now means a real bug.
      // ---------------------------------------------------------------------

      // Ergonomic/documentation rule; this project does not use prop-types.
      'react/prop-types': 'off',

      // Genuinely useful, but a dependency-array cleanup is its own project and
      // a wrong "fix" here changes runtime behaviour.
      'react-hooks/exhaustive-deps': 'warn',

      // eslint-plugin-react-hooks v7 ships the React Compiler rule set in
      // `recommended`. These are lint-by-static-analysis opinions about
      // memoisation and purity, not the hook-ordering invariants that break
      // rendering. Useful signal, far too loud to gate on today.
      'react-hooks/static-components': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/unsupported-syntax': 'warn',

      // Stylistic leftovers from `eslint:recommended` that are noise here.
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'warn',
    },
  },

  {
    // Build/tooling files run in Node, not the browser.
    files: [
      '*.config.js',
      '*.config.cjs',
      'scripts/**/*.{js,mjs,cjs}',
      'vite.config.js',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
