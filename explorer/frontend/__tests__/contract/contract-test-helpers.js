import variantNames from '@/contract/variants.json';
import path from 'path';

const VARIANTS_DIRECTORY = path.join(__dirname, '../../variants');
const PUBLIC_DIRECTORY = path.join(__dirname, '../../public');

export const describeEachVariant = callback => {
	variantNames.forEach(variant => describe(variant, () => callback(variant)));
};

export const getVariantPath = (variant, ...segments) => path.join(VARIANTS_DIRECTORY, variant, ...segments);

export const getVariantPublicPath = (variant, ...segments) => path.join(PUBLIC_DIRECTORY, variant, ...segments);

export const loadVariantModule = (variant, modulePath) => require(getVariantPath(variant, modulePath));
