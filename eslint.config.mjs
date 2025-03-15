import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import unicorn from 'eslint-plugin-unicorn';
import prettiereslint from 'eslint-plugin-prettier/recommended';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

export default [
	{
		ignores: [
			'eslint.config.mjs',
			'**/node_modules',
			'**/__types_momentum.js',
			'**/tools',
			'scripts/types',
			'scripts/common/web.ts'
		]
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	prettiereslint,
	{
		languageOptions: {
			ecmaVersion: 5,
			sourceType: 'module',
			globals: globals.builtin,
			parserOptions: {
				project: 'tsconfig.json'
			}
		},
		files: ['**/*.ts'],
		rules: {
			'prettier/prettier': ['warn'],
			quotes: ['error', 'single', { avoidEscape: true }],
			'prefer-const': ['error'],
			'no-empty': ['error', { allowEmptyCatch: true }],
			camelcase: ['off'], // Annoying for some types and keys used in various data structures. Just yell at people!
			eqeqeq: ['error', 'smart'],
			'no-var': ['error'],
			'no-useless-constructor': ['error'],
			'no-unused-expressions': ['error', { allowTernary: true }],
			'prefer-arrow-callback': ['error'],
			'@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': 'off', // unused-imports handles this
			'@typescript-eslint/no-inferrable-types': ['warn', { ignoreParameters: true }],
			// TypeScript's type narrowing isn't infallible, quite common to have
			// cases of this, I don't find the warning helpful, better to bring
			// up in review.
			'@typescript-eslint/no-non-null-assertion': ['off'],
			// Used by ambient TS files
			'@typescript-eslint/triple-slash-reference': ['off'],
			// Yells at us for panel interfaces that are important
			'@typescript-eslint/no-empty-object-type': ['off']
		}
	},
	// Unused imports
	{
		plugins: { 'unused-imports': unusedImports },
		rules: {
			'unused-imports/no-unused-imports': 'error'
		}
	},
	// Unicorn. Recommended config has too much dumb stuff.
	{
		languageOptions: { globals: globals.builtin },
		plugins: { unicorn },
		rules: {
			'unicorn/better-regex': 'error',
			'unicorn/consistent-destructuring': 'error',
			'unicorn/consistent-empty-array-spread': 'error',
			'unicorn/consistent-existence-index-check': 'error',
			'unicorn/error-message': 'error',
			'unicorn/expiring-todo-comments': 'error',
			'unicorn/explicit-length-check': 'error',
			'unicorn/new-for-builtins': 'error',
			'unicorn/no-array-push-push': 'error',
			'unicorn/no-for-loop': 'error',
			'unicorn/no-length-as-slice-end': 'error',
			'unicorn/no-lonely-if': 'error',
			'unicorn/no-new-buffer': 'error',
			'unicorn/no-typeof-undefined': 'error',
			'unicorn/no-unnecessary-await': 'error',
			'unicorn/no-unreadable-array-destructuring': 'error',
			'unicorn/no-useless-length-check': 'error',
			'unicorn/no-useless-spread': 'error',
			'unicorn/no-useless-undefined': 'error',
			'unicorn/prefer-array-find': 'error',
			'unicorn/prefer-array-flat': 'error',
			'unicorn/prefer-array-flat-map': 'error',
			'unicorn/prefer-array-some': 'error',
			'unicorn/prefer-array-index-of': 'error',
			'unicorn/prefer-date-now': 'error',
			'unicorn/prefer-includes': 'error',
			'unicorn/prefer-object-from-entries': 'error',
			'unicorn/prefer-set-has': 'error',
			'unicorn/prefer-set-size': 'error',
			'unicorn/prefer-string-starts-ends-with': 'error',
			'unicorn/prefer-structured-clone': 'error',
			'unicorn/throw-new-error': 'error'
		}
	}
];
