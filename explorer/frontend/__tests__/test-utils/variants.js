export const activeVariant = process.env.NEXT_PUBLIC_EXPLORER_VARIANT;

const variantDisplayNames = {
	nem: 'NEM',
	symbol: 'Symbol'
};

export const formatVariantDescription = (variantIds, description) =>
	`(${variantIds.map(variantId => variantDisplayNames[variantId] ?? variantId).join('/')} specific) ${description}`;

export const describeVariant = variantId => (name, body) =>
	(variantId === activeVariant ? describe : describe.skip)(formatVariantDescription([variantId], name), body);

export const itVariant = variantId => (name, body) =>
	(variantId === activeVariant ? it : it.skip)(formatVariantDescription([variantId], name), body);
