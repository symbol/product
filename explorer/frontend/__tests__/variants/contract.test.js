import {
	API_CONTRACT,
	CONFIG_CONTRACT,
	PAGE_CONFIG_CONTRACT,
	STYLE_VARIABLES_CONTRACT,
	THEME_STYLESHEET_DIRS,
	UTILS_CONTRACT
} from '@/app/variants/contract';
import { VARIANT_IDS, variants } from '@/app/variants/manifest';
// Use require for Node built-ins because the repo's import resolver trips on core-module imports.
// The SCSS theme token contract is verified by reading the source stylesheets from disk.
const fs = require('fs');
const path = require('path');

// Read variants from the manifest so new variants automatically enter this contract.

// Parse raw SCSS to verify that every variant provides the tokens shared styles consume.
// next.config.js injects styles/variables.scss and the active variant's variables.scss together.

const FRONTEND_ROOT = path.resolve(__dirname, '../../');

// Each variant declares theme tokens in styles/variables.scss.
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

// Strip comments to avoid false-positive token matches while parsing raw SCSS.
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

// Shared stylesheets consume common tokens from styles/variables.scss and variant tokens from the
// active variant's variables.scss.
const sharedStylesheets = THEME_STYLESHEET_DIRS.flatMap(collectStylesheets);

// Tokens declared in shared styles are already provided centrally, so variants should not redeclare them.
const sharedDeclaredTokens = new Set();
sharedStylesheets.forEach(stylesheet => {
	parseDeclaredTokens(readStylesheet(stylesheet)).forEach(token => sharedDeclaredTokens.add(token));
});

// Tokens consumed by shared styles but not declared there must be provided by every variant.
const requiredThemeTokens = new Set();
sharedStylesheets.forEach(stylesheet => {
	parseReferencedTokens(readStylesheet(stylesheet)).forEach(token => {
		if (!sharedDeclaredTokens.has(token))
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

			describe('utils surface', () => {
				const runUtilsContractTest = (domain, functionName) => {
					// Act:
					const member = variant.utils[domain]?.[functionName];

					// Assert:
					expect(typeof member).toBe('function');
				};

				Object.entries(UTILS_CONTRACT).forEach(([domain, functionNames]) => {
					functionNames.forEach(functionName => {
						it(`exposes utils.${domain}.${functionName}`, () => runUtilsContractTest(domain, functionName));
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

		// Act & Assert: each variant's styles/variables.json must match the shared contract exactly.
		Object.entries(variants).forEach(([, variant]) => {
			expect(Object.keys(variant.styleVariables).sort()).toEqual(expectedKeys);
		});
	});
});
