import { SYMBOL_MESSAGE_TYPE } from '../constants';

/** @typedef {import('@/contract/types/Config').ValueMessageConfig} ValueMessageConfig */

/** @type {ValueMessageConfig} */
export const valueMessageConfig = {
	labelLocaleKeys: {
		[SYMBOL_MESSAGE_TYPE.ENCRYPTED]: 'label_encrypted',
		[SYMBOL_MESSAGE_TYPE.DELEGATED_HARVESTING]: 'label_harvestingRequest',
		[SYMBOL_MESSAGE_TYPE.RAW]: 'label_hex'
	}
};
