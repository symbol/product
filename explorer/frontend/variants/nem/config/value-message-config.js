import { NEM_MESSAGE_TYPE } from '../constants';

/** @typedef {import('@/contract/types/Config').ValueMessageConfig} ValueMessageConfig */

/** @type {ValueMessageConfig} */
export const valueMessageConfig = {
	labelLocaleKeys: {
		[NEM_MESSAGE_TYPE.ENCRYPTED]: 'label_encrypted',
		[NEM_MESSAGE_TYPE.RAW]: 'label_hex'
	}
};
