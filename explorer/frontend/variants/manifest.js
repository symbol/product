// Registered variants, consumed by the contract test when it walks every implementation.
import { VARIANT_IDS } from './ids';
import * as nem from './nem';
import * as symbol from './symbol';

export const variants = {
	nem,
	symbol
};

export { VARIANT_IDS };
