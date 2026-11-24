import { describeEachVariant, getVariantPath, loadVariantModule } from './contract-test-helpers';
import { StyleTokenType, requiredJsStyleTokens, requiredScssStyleTokens } from '@/contract/styles';
import fs from 'fs';
import path from 'path';

const FRONTEND_DIRECTORY = path.join(__dirname, '../..');
const SHARED_STYLESHEET_DIRECTORIES = ['styles'];
const SCSS_STYLE_TOKENS_PATH = 'styles/variables.scss';
const JS_STYLE_TOKENS_PATH = 'styles/variables.json';

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_PATTERN = /^rgba?\(.+\)$/;
const TRANSPARENT_COLOR = 'transparent';
const SIZE_PATTERN = /^-?\d*\.?\d+(px|rem|em|%)$/;
const FONT_STYLE_OR_WEIGHT_PATTERN = /((normal|italic|bold|\d{3})\s+)*/;
const FONT_SIZE_AND_LINE_HEIGHT_PATTERN = /-?\d*\.?\d+(px|rem|em|%)(\s*\/\s*-?\d*\.?\d+(px|rem|em|%)?)?/;
const FONT_FAMILY_LIST_PATTERN = /('[^']+'|"[^"]+"|[\w-]+)(\s*,\s*('[^']+'|"[^"]+"|[\w-]+))*/;
const FONT_FAMILY_PATTERN = new RegExp(`^${FONT_FAMILY_LIST_PATTERN.source}$`);
// CSS font shorthand: [style/weight] size[/line-height] family, e.g. `700 1rem / 133.33% 'Nunito Sans', sans-serif`.
const FONT_PATTERN = new RegExp([
	'^',
	FONT_STYLE_OR_WEIGHT_PATTERN.source,
	FONT_SIZE_AND_LINE_HEIGHT_PATTERN.source,
	/\s+/.source,
	FONT_FAMILY_LIST_PATTERN.source,
	'$'
].join(''));
const TEXT_TRANSFORMS = ['capitalize', 'lowercase', 'none', 'uppercase'];

const isColor = value => typeof value === 'string'
	&& (HEX_COLOR_PATTERN.test(value) || RGB_COLOR_PATTERN.test(value) || value === TRANSPARENT_COLOR);

const isFont = value => FONT_PATTERN.test(value);

const isFontFamily = value => FONT_FAMILY_PATTERN.test(value);

const isNonEmptyString = value => typeof value === 'string' && value.length > 0;

const isSize = value => SIZE_PATTERN.test(value);

const isTextTransform = value => TEXT_TRANSFORMS.includes(value);

const isTokenValueValid = {
	[StyleTokenType.ANY]: isNonEmptyString,
	[StyleTokenType.COLOR]: isColor,
	[StyleTokenType.FONT]: isFont,
	[StyleTokenType.FONT_FAMILY]: isFontFamily,
	[StyleTokenType.SIZE]: isSize,
	[StyleTokenType.TEXT_TRANSFORM]: isTextTransform
};

const readStylesheet = filePath => fs.readFileSync(filePath, 'utf8');

const collectStylesheets = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
	const entryPath = path.join(directory, entry.name);

	if (entry.isDirectory())
		return collectStylesheets(entryPath);

	return entry.name.endsWith('.scss') ? [entryPath] : [];
});

const stripComments = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/gm, '$1');

// Token declarations in a stylesheet, e.g. `$color-primary: #fff;` -> { 'color-primary': '#fff' }.
const parseDeclaredTokens = source => Object.fromEntries([...stripComments(source).matchAll(/^\s*\$([\w-]+)\s*:\s*([^;]+);/gm)]
	.map(match => [match[1], match[2].trim()]));

// Token names referenced in a stylesheet, e.g. `color: $color-primary;` -> 'color-primary'.
const parseReferencedTokens = source => [...stripComments(source).matchAll(/\$([\w-]+)/g)].map(match => match[1]);

const loadVariantScssTokens = variant => parseDeclaredTokens(readStylesheet(getVariantPath(variant, SCSS_STYLE_TOKENS_PATH)));

const getSharedScssTokenUsage = () => {
	const sharedSources = SHARED_STYLESHEET_DIRECTORIES
		.flatMap(directory => collectStylesheets(path.join(FRONTEND_DIRECTORY, directory)))
		.map(readStylesheet);
	const sharedDeclaredTokens = sharedSources.flatMap(source => Object.keys(parseDeclaredTokens(source)));
	const usedTokens = sharedSources
		.flatMap(parseReferencedTokens)
		.filter(token => !sharedDeclaredTokens.includes(token));

	return [...new Set(usedTokens)];
};

const validateTokens = (variantTokens, requiredTokens) => {
	const requiredTokenErrors = Object.entries(requiredTokens).flatMap(([name, requiredType]) => {
		if (variantTokens[name] === undefined)
			return [`${name} — missing`];

		if (!isTokenValueValid[requiredType](variantTokens[name]))
			return [`${name} — invalid ${requiredType}`];

		return [];
	});
	const unexpectedTokenErrors = Object.keys(variantTokens)
		.filter(name => !(name in requiredTokens))
		.map(name => `${name} — unexpected`);

	return [...requiredTokenErrors, ...unexpectedTokenErrors];
};

const validateTokenUsage = (usedTokens, requiredTokens) => {
	const unlistedTokenErrors = usedTokens
		.filter(name => !(name in requiredTokens))
		.map(name => `${name} — used by shared stylesheets, not in the contract`);
	const unusedTokenErrors = Object.keys(requiredTokens)
		.filter(name => !usedTokens.includes(name))
		.map(name => `${name} — in the contract, not used by shared stylesheets`);

	return [...unlistedTokenErrors, ...unusedTokenErrors];
};

const styleTokenSets = [
	{
		name: 'scss',
		path: SCSS_STYLE_TOKENS_PATH,
		requiredTokens: requiredScssStyleTokens,
		loadTokens: loadVariantScssTokens
	},
	{
		name: 'js',
		path: JS_STYLE_TOKENS_PATH,
		requiredTokens: requiredJsStyleTokens,
		loadTokens: variant => loadVariantModule(variant, JS_STYLE_TOKENS_PATH)
	}
];

describe('contract/styles', () => {
	describeEachVariant(variant => {
		styleTokenSets.forEach(styleTokenSet => {
			it(`${styleTokenSet.name} tokens in ${styleTokenSet.path} match the contract`, () => {
				// Arrange:
				const variantTokens = styleTokenSet.loadTokens(variant);

				// Act:
				const tokenErrors = validateTokens(variantTokens, styleTokenSet.requiredTokens);

				// Assert:
				expect(tokenErrors).toEqual([]);
			});
		});
	});

	it('requiredScssStyleTokens lists exactly the tokens the shared stylesheets use', () => {
		// Arrange:
		const usedTokens = getSharedScssTokenUsage();

		// Act:
		const tokenErrors = validateTokenUsage(usedTokens, requiredScssStyleTokens);

		// Assert:
		expect(tokenErrors).toEqual([]);
	});
});
