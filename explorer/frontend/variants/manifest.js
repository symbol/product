// Registered variants, consumed by the contract test when it walks every implementation.
import * as nem from './nem';
import * as symbol from './symbol';

export const variants = {
	nem,
	symbol
};

export const VARIANT_IDS = Object.keys(variants);
