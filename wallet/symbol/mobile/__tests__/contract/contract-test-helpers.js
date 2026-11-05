import brandNames from '@/contract/brands.json';
import path from 'path';

const BRANDS_DIRECTORY = path.join(__dirname, '../../src/brands');


export const describeEachBrand = callback => {
	brandNames.forEach(brand => describe(brand, () => callback(brand)));
};

export const getBrandPath = (brand, ...segments) => path.join(BRANDS_DIRECTORY, brand, ...segments);

export const loadBrandModule = (brand, modulePath) => require(getBrandPath(brand, modulePath));
