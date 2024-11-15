import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import unicorn from 'eslint-plugin-unicorn';
import prettiereslint from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default [
	{
		ignores: [
			'eslint.config.mjs',
			'**/node_modules',
			'**/__types_momentum.js',
			'**/tools',
			'scripts/types'
		]
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	unicorn.configs['flat/recommended'],
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
			'no-unused-vars': ['off'],
			'@typescript-eslint/no-unused-vars': ['off'],
			'@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
			// Used by ambient TS files
			'@typescript-eslint/triple-slash-reference': ['off'],
			// Yells at us for panel interfaces that are important
			'@typescript-eslint/no-empty-object-type': ['off'],
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'variable',
					types: ['boolean', 'string', 'number'],
					modifiers: ['global'],
					format: ['UPPER_CASE']
				},
				{
					selector: 'variable',
					types: ['boolean', 'string', 'number'],
					modifiers: ['exported'],
					format: ['strictCamelCase', 'UPPER_CASE']
				},
				{
					selector: 'class',
					format: ['PascalCase']
				},
				{
					selector: 'enumMember',
					format: ['UPPER_CASE']
				},
				{
					selector: 'typeParameter',
					format: ['PascalCase']
				},
				{
					selector: 'interface',
					format: ['PascalCase'],
					custom: { regex: '^I[A-Z]', match: false }
				}
			],
			// We don't need to be that petty about using types well in a repo like this.
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-inferrable-types': ['warn', { ignoreParameters: true }],
			// I'd love to use this but too annoying a refactor, some C++ APIs look like they use `null`.
			'unicorn/no-null': ['off'],
			// Way too sensitive. Most cases it catches are silly, and bad naming is easy to flag in review.
			'unicorn/prevent-abbreviations': ['off'],
			// Not going to make devs use obscure JS syntax for something so minor.
			'unicorn/numeric-separators-style': ['warn', { onlyIfContainsSeparator: true }],
			// Our JS modules implementation doesn't support top level await.
			'unicorn/prefer-top-level-await': ['off'],
			// Even though unicorn has a rule for no nested ternaries, it's insisting I make them due to this rule.
			'unicorn/prefer-ternary': ['error', 'only-single-line'],
			// Better parity with other languages, we use `1 << 0` frequently next to other shifts when defining bitflags.
			'unicorn/prefer-math-trunc': ['off'],
			// Why???
			'unicorn/switch-case-braces': ['off'],
			// Fuck you I wanna
			'unicorn/no-abusive-eslint-disable': ['off'],
			// Terrible rule, it's often practically useful to explicitly state what's happening in cases
			'unicorn/no-useless-switch-case': ['off'],
			// In certain cases this matters, but often completely redundant as V8 optimises it fine.
			// Worth flagging potential cases in code review, but annoying as a linting rule
			'unicorn/consistent-function-scoping': ['off'],
			// This is an annoying rule. Often you want to handle negated a condition first as some edge-case.
			'unicorn/no-negated-condition': ['off'],
			// Often clearer using .forEach. Also it's not usually a perf benefit, V8 optimises somehow.
			'unicorn/no-array-for-each': ['off'],
			// False positives (we don't use node!)
			'unicorn/prefer-node-protocol': 'off',
			// Math.hypot is slower than Math.sqrt in V8
			// https://stackoverflow.com/questions/71898044/why-is-math-hypot-so-slow
			'unicorn/prefer-modern-math-apis': 'off'
		}
	}
];
