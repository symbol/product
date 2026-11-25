import { TRANSACTION_TYPE } from '../transaction/transaction-types';

/** @typedef {import('@/contract/types/Config').TransactionBodyField} TransactionBodyField */
/** @typedef {import('@/contract/types/Config').TransactionGraphicConfig} TransactionGraphicConfig */
/** @typedef {import('@/contract/types/Config').TransactionInfoPageConfig} TransactionInfoPageConfig */

/** @type {TransactionGraphicConfig} */
const mosaicGraphic = {
	target: { name: 'mosaicId', renderer: 'mosaic', localeKey: 'field_targetMosaic' }
};

/** @type {TransactionBodyField[]} */
const rentalFeeBodyFields = [
	{ name: 'rentalFeeSink', renderer: 'account' },
	{ name: 'rentalFee', renderer: 'fee' }
];

/** @type {TransactionInfoPageConfig} */
export const transactionInfoPageConfig = {
	transactions: {
		[TRANSACTION_TYPE.TRANSFER]: {
			graphic: {
				target: { name: 'recipient', renderer: 'account', localeKey: 'field_recipient' }
			},
			bodyFields: [
				{ name: 'mosaics', renderer: 'mosaicAmount' },
				{ name: 'message', renderer: 'message' }
			]
		},
		[TRANSACTION_TYPE.MOSAIC_DEFINITION]: {
			graphic: mosaicGraphic,
			bodyFields: rentalFeeBodyFields
		},
		[TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE]: {
			graphic: mosaicGraphic,
			bodyFields: [
				{ name: 'delta', renderer: 'delta' }
			]
		},
		[TRANSACTION_TYPE.NAMESPACE_REGISTRATION]: {
			graphic: {
				target: { name: 'namespaceId', renderer: 'namespace', localeKey: 'field_targetNamespace' }
			},
			bodyFields: rentalFeeBodyFields
		},
		[TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION]: {
			graphic: {
				target: { name: 'sender', renderer: 'account', localeKey: 'field_targetAccount' }
			},
			bodyFields: [
				{ name: 'minCosignatories', renderer: 'delta' },
				{ name: 'addressAdditions', renderer: 'account' },
				{ name: 'addressDeletions', renderer: 'account' }
			]
		},
		[TRANSACTION_TYPE.ACCOUNT_KEY_LINK]: {
			graphic: {
				target: { name: 'linkedAccountAddress', renderer: 'account', localeKey: 'field_linkedAccount' }
			},
			bodyFields: [
				{ name: 'linkAction', renderer: 'translate' },
				{ name: 'linkedPublicKey', renderer: 'copy' }
			]
		}
	}
};
