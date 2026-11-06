import { describeEachBrand, loadBrandModule } from './contract-test-helpers';
import { StyleTokenType, requiredStyleTokens } from '@/contract/styles';

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_PATTERN = /^rgba?\(.+\)$/;
const TRANSPARENT_COLOR = 'transparent';

const isColor = value => typeof value === 'string'
	&& (HEX_COLOR_PATTERN.test(value) || RGB_COLOR_PATTERN.test(value) || value === TRANSPARENT_COLOR);

const isShadowLayer = shadow => Number.isFinite(shadow?.offsetX)
	&& Number.isFinite(shadow.offsetY)
	&& Number.isFinite(shadow.blurRadius)
	&& isColor(shadow.color);

const isShadow = value => Array.isArray(value) && value.every(isShadowLayer);

const isTextStyle = value => typeof value?.fontFamily === 'string'
	&& Number.isFinite(value.fontSize)
	&& Number.isFinite(value.lineHeight);

const isTokenValueValid = {
	[StyleTokenType.COLOR]: isColor,
	[StyleTokenType.SIZE]: Number.isFinite,
	[StyleTokenType.SHADOW]: isShadow,
	[StyleTokenType.TEXT_STYLE]: isTextStyle
};

const validateTokens = (brandTokens, requiredTokens, parentKeyPath = '') => {
	const requiredTokenErrors = Object.entries(requiredTokens).flatMap(([key, requiredToken]) => {
		const keyPath = parentKeyPath + key;
		const brandToken = brandTokens?.[key];

		if (brandToken === undefined)
			return [`${keyPath} — missing`];

		if (typeof requiredToken === 'object')
			return validateTokens(brandToken, requiredToken, `${keyPath}.`);
		
		if (!isTokenValueValid[requiredToken](brandToken))
			return [`${keyPath} — invalid ${requiredToken}`];

		return [];
	});
	const unexpectedTokenErrors = Object.keys(brandTokens ?? {})
		.filter(key => !(key in requiredTokens))
		.map(key => `${parentKeyPath}${key} — unexpected`);

	return [...requiredTokenErrors, ...unexpectedTokenErrors];
};

describe('contract/styles', () => {
	describeEachBrand(brand => {
		Object.entries(requiredStyleTokens).forEach(([category, requiredStyleTokenLayers]) => {
			Object.entries(requiredStyleTokenLayers).forEach(([styleTokenLayer, requiredTokens]) => {
				it(`${category}.${styleTokenLayer} matches the contract`, () => {
					// Arrange:
					const brandStyles = loadBrandModule(brand, 'styles');
					const brandTokens = brandStyles[category][styleTokenLayer];

					// Act:
					const tokenErrors = validateTokens(brandTokens, requiredTokens);

					// Assert:
					expect(tokenErrors).toEqual([]);
				});
			});
		});
	});
});
