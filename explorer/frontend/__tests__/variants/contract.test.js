import {
	API_CONTRACT,
	CONFIG_CONTRACT,
	PAGE_CONFIG_CONTRACT,
	STYLE_VARIABLES_CONTRACT,
	THEME_STYLESHEET_DIRS
} from '@/app/variants/contract';
import { VARIANT_IDS, variants } from '@/app/variants/manifest';
// Node built-ins via require: the repo's eslint only registers the jsconfig import resolver, so
// `import` of a core module crashes import/no-deprecated. The SCSS theme tokens live in .scss
// files, so the contract reads them off disk.
const fs = require('fs');
const path = require('path');

// Every registered variant is taken from the manifest (the single source of truth the resolvers
// and the build alias derive from), so adding a variant there enforces the contract for it too.

// SCSS theme tokens
// The active variant's styles/variables.scss is injected into every stylesheet at build time
// (next.config.js sassOptions.additionalData). These helpers parse the raw SCSS so the contract
// can assert every variant declares the tokens the shared stylesheets consume and that the
// variants stay in sync.

const FRONTEND_ROOT = path.resolve(__dirname, '../../');

// Each variant's theme stylesheet follows this convention (see contract.js THEME_STYLESHEET_DIRS).
const variantThemeStylesheet = variantId => `variants/${variantId}/styles/variables.scss`;

const readStylesheet = relativePath => fs.readFileSync(path.join(FRONTEND_ROOT, relativePath), 'utf8');

// All .scss files (recursively) under a directory, as paths relative to the frontend root.
const collectStylesheets = relativeDir => {
	const entries = fs.readdirSync(path.join(FRONTEND_ROOT, relativeDir), { withFileTypes: true });

	return entries.flatMap(entry => {
		const entryPath = path.join(relativeDir, entry.name);

		if (entry.isDirectory())
			return collectStylesheets(entryPath);

		return entry.name.endsWith('.scss') ? [entryPath] : [];
	});
};

const stripComments = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

// Token names declared in a stylesheet, e.g. `$color-primary: #fff;` -> 'color-primary'.
const parseDeclaredTokens = source => new Set([...stripComments(source).matchAll(/^\s*\$([\w-]+)\s*:/gm)].map(match => match[1]));

// Token names referenced in a stylesheet, e.g. `color: $color-primary;` -> 'color-primary'.
const parseReferencedTokens = source => new Set([...stripComments(source).matchAll(/\$([\w-]+)/g)].map(match => match[1]));

// Theme tokens each variant declares in its styles/variables.scss.
const declaredTokensByVariant = {};
VARIANT_IDS.forEach(variantId => {
	declaredTokensByVariant[variantId] = parseDeclaredTokens(readStylesheet(variantThemeStylesheet(variantId)));
});

// Tokens the shared stylesheets consume (referenced minus any locally-declared vars) and which
// every variant must therefore provide.
const requiredThemeTokens = new Set();
THEME_STYLESHEET_DIRS.flatMap(collectStylesheets).forEach(stylesheet => {
	const source = readStylesheet(stylesheet);
	const localTokens = parseDeclaredTokens(source);

	parseReferencedTokens(source).forEach(token => {
		if (!localTokens.has(token))
			requiredThemeTokens.add(token);
	});
});

describe('variants contract', () => {
	Object.entries(variants).forEach(([variantName, variant]) => {
		describe(variantName, () => {
			describe('api surface', () => {
				const runApiContractTest = (domain, functionName) => {
					// Act:
					const member = variant.api[domain]?.[functionName];

					// Assert:
					expect(typeof member).toBe('function');
				};

				Object.entries(API_CONTRACT).forEach(([domain, functionNames]) => {
					functionNames.forEach(functionName => {
						it(`exposes api.${domain}.${functionName}`, () => runApiContractTest(domain, functionName));
					});
				});
			});

			describe('style tokens', () => {
				STYLE_VARIABLES_CONTRACT.forEach(token => {
					it(`provides style token ${token}`, () => {
						// Assert:
						expect(typeof variant.styleVariables[token]).toBe('string');
					});
				});
			});

			describe('page config', () => {
				Object.entries(PAGE_CONFIG_CONTRACT).forEach(([page, keys]) => {
					keys.forEach(key => {
						it(`pageConfig.${page} defines ${key}`, () => {
							// Assert:
							expect(variant.pageConfig[page]).toHaveProperty(key);
						});
					});
				});
			});

			describe('config keys', () => {
				(CONFIG_CONTRACT[variantName] || []).forEach(key => {
					it(`config defines ${key}`, () => {
						// Assert:
						expect(variant.config).toHaveProperty(key);
					});
				});
			});

			it('provides a DocumentHead component', () => {
				// Assert:
				expect(typeof variant.DocumentHead).toBe('function');
			});

			it('provides a section component map', () => {
				// Assert:
				expect(variant.components).toEqual(expect.any(Object));
			});
		});
	});
});

describe('variants scss theme tokens', () => {
	describe('every variant declares the tokens the shared stylesheets consume', () => {
		Object.entries(declaredTokensByVariant).forEach(([variantName, declaredTokens]) => {
			[...requiredThemeTokens].forEach(token => {
				it(`${variantName} declares $${token}`, () => {
					// Assert:
					expect(declaredTokens.has(token)).toBe(true);
				});
			});
		});
	});

	it('all variants declare an identical theme token set', () => {
		// Arrange: compare every other variant against the first (reference) variant.
		const [referenceName, ...otherNames] = Object.keys(declaredTokensByVariant);
		const referenceTokens = declaredTokensByVariant[referenceName];

		// Act & Assert: neither side may have tokens the other lacks.
		otherNames.forEach(variantName => {
			const variantTokens = declaredTokensByVariant[variantName];
			const expectedDrift = { missing: [], extra: [] };
			const drift = {
				missing: [...referenceTokens].filter(token => !variantTokens.has(token)).sort(),
				extra: [...variantTokens].filter(token => !referenceTokens.has(token)).sort()
			};

			expect(drift).toEqual(expectedDrift);
		});
	});
});

describe('variants style variables (json)', () => {
	it('every variant exposes exactly the contract style variables (same keys)', () => {
		// Arrange:
		const expectedKeys = [...STYLE_VARIABLES_CONTRACT].sort();

		// Act & Assert: each variant's styles/variables.json must hold exactly the contract keys,
		// so nem and symbol stay in sync (no variable defined in one variant but missing in the other).
		Object.entries(variants).forEach(([, variant]) => {
			expect(Object.keys(variant.styleVariables).sort()).toEqual(expectedKeys);
		});
	});
});
