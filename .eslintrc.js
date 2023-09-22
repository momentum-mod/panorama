module.exports = {
	plugins: ['unicorn', 'prettier'],
	extends: ['eslint:recommended', 'plugin:unicorn/recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
	root: true,
	parserOptions: { project: 'tsconfig.json' },
	ignorePatterns: ['.eslintrc.js', 'node_modules', '__types_momentum.js', 'tools', 'scripts_dist'],
	rules: {
		// We don't use modules or really any kind of import system.
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'unicorn/prefer-module': ['off'],
		// This is fine for us, as we don't use imports.
		'@typescript-eslint/triple-slash-reference': ['off'],
		quotes: ['error', 'single', { avoidEscape: true }],
		'prefer-const': ['error'],
		'no-empty': ['error', { allowEmptyCatch: true }],
		'class-methods-use-this': ['error'],
		camelcase: ['warn'],
		eqeqeq: ['error', 'smart'],
		'no-var': ['error'],
		'no-useless-constructor': ['error'],
		'no-unused-expressions': ['error', { allowTernary: true }],
		'prefer-arrow-callback': ['error'],
		// `tsc` adds this automatically.
		strict: ['off'],
		// Terrible for us, gets confused by stuff defined in other files that are in same context
		// due being in the same <imports> block.
		'no-undef': ['off'],
		'no-unused-vars': ['off'],
		'@typescript-eslint/no-unused-vars': ['off'],
		// I'd love to use this but too annoying a refactor, some C++ APIs look like they use `null`.
		'unicorn/no-null': ['off'],
		// Way too sensitive. Most cases it catches are silly, and bad naming is easy to flag in review.
		'unicorn/prevent-abbreviations': ['off'],
		// Not going to make devs use obscure JS syntax for something so minor.
		'unicorn/numeric-separators-style': ['warn', { onlyIfContainsSeparator: true }],
		// This will hit for async IIFEs and warn about module crap. We don't use modules.
		'unicorn/prefer-top-level-await': ['off'],
		// Even though unicorn has a rule for no nested ternaries, it's insisting I make them due to this rule.
		'unicorn/prefer-ternary': ['error', 'only-single-line'],
		// Better parity with other languages, we use `1 << 0` frequently next to other shifts when defining bitflags.
		'unicorn/prefer-math-trunc': ['off'],
		// Why???
		'unicorn/switch-case-braces': ['off'],
		// We like using static classes since we can use the ES2022 static initalisation blocks.
		// This rule doesn't apply to classes with those blocks, but it's just annoying to differentiate
		// the cases with and without static ctors. May as well just use everywhere, even if the JS nerds are
		// correct that a static only class (without static ctor) can just be an Object.
		'unicorn/no-static-only-class': ['off'],
		// Fuck you I wanna
		'unicorn/no-abusive-eslint-disable': ['off'],
		// Terrible rule, it's often practically useful to explicitly state what's happening in cases
		'unicorn/no-useless-switch-case': ['off'],
		// In certain cases this matters, but often completely redundant as V8 optimises it fine. Worth flagging potential cases in code review, but annoying as a linting rule
		'unicorn/consistent-function-scoping': ['off'],
		// This is an annoying rule. Often you want to handle negated a condition first as some edge-case.
		'unicorn/no-negated-condition': ['off'],
		// Fuck you, I want it
		'unicorn/no-array-for-each': ['off'],
		'@typescript-eslint/no-empty-function': [
			'error',
			{
				allow: ['arrowFunctions']
			}
		],
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
				custom: {
					regex: '^I[A-Z]',
					match: false
				}
			}
		],
		// We don't need to be that petty about using types well in a repo like this.
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-inferrable-types': ['warn', { ignoreParameters: true }]
	}
};
