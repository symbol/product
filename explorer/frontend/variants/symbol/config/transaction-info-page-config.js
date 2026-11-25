import { TRANSACTION_TYPE } from '../transaction/transaction-types';

/** @typedef {import('@/contract/types/Config').TransactionBodyField} TransactionBodyField */
/** @typedef {import('@/contract/types/Config').TransactionGraphicConfig} TransactionGraphicConfig */
/** @typedef {import('@/contract/types/Config').TransactionInfoPageConfig} TransactionInfoPageConfig */

/** @type {TransactionGraphicConfig} */
const recipientGraphic = {
	target: { name: 'recipient', renderer: 'account', localeKey: 'field_recipient' }
};

/** @type {TransactionGraphicConfig} */
const senderGraphic = {
	target: { name: 'sender', renderer: 'account', localeKey: 'field_targetAccount' }
};

/** @type {TransactionGraphicConfig} */
const targetAddressGraphic = {
	target: { name: 'targetAddress', renderer: 'account', localeKey: 'field_targetAccount' }
};

/** @type {TransactionGraphicConfig} */
const linkedAccountGraphic = {
	target: { name: 'linkedAccountAddress', renderer: 'account', localeKey: 'field_linkedAccount' }
};

/** @type {TransactionGraphicConfig} */
const mosaicGraphic = {
	target: { name: 'mosaicId', renderer: 'mosaic', localeKey: 'field_targetMosaic' }
};

/** @type {TransactionBodyField[]} */
const aliasBodyFields = [
	{ name: 'aliasAction', renderer: 'translate' },
	{ name: 'namespaceName', renderer: 'text' },
	{ name: 'namespaceId', renderer: 'namespace' }
];

/** @type {TransactionBodyField[]} */
const keyLinkBodyFields = [
	{ name: 'linkAction', renderer: 'translate' },
	{ name: 'linkedPublicKey', renderer: 'copy' }
];

/** @type {TransactionBodyField[]} */
const metadataBodyFields = [
	{ name: 'scopedMetadataKey', renderer: 'text' },
	{ name: 'valueDelta', renderer: 'copy' },
	{ name: 'valueSizeDelta', renderer: 'text' }
];

/** @type {TransactionInfoPageConfig} */
export const transactionInfoPageConfig = {
	transactions: {
		[TRANSACTION_TYPE.TRANSFER]: {
			graphic: recipientGraphic,
			bodyFields: [
				{ name: 'mosaics', renderer: 'mosaicAmount' },
				{ name: 'message', renderer: 'message' }
			]
		},
		[TRANSACTION_TYPE.NAMESPACE_REGISTRATION]: {
			graphic: {
				target: { name: 'namespaceId', renderer: 'namespace', localeKey: 'field_targetNamespace' }
			},
			bodyFields: [
				{ name: 'namespaceName', renderer: 'text' },
				{ name: 'registrationType', renderer: 'translate' },
				{ name: 'parentId', renderer: 'namespace' },
				{ name: 'duration', renderer: 'text' }
			]
		},
		[TRANSACTION_TYPE.ADDRESS_ALIAS]: {
			graphic: {
				target: { name: 'address', renderer: 'account', localeKey: 'field_targetAccount' }
			},
			bodyFields: aliasBodyFields
		},
		[TRANSACTION_TYPE.MOSAIC_ALIAS]: {
			graphic: mosaicGraphic,
			bodyFields: aliasBodyFields
		},
		[TRANSACTION_TYPE.MOSAIC_DEFINITION]: {
			graphic: mosaicGraphic,
			bodyFields: [
				{ name: 'divisibility', renderer: 'text' },
				{ name: 'duration', renderer: 'text' },
				{ name: 'supplyMutable', renderer: 'boolean' },
				{ name: 'transferable', renderer: 'boolean' },
				{ name: 'restrictable', renderer: 'boolean' },
				{ name: 'revokable', renderer: 'boolean' }
			]
		},
		[TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE]: {
			graphic: mosaicGraphic,
			bodyFields: [
				{ name: 'delta', renderer: 'delta' }
			]
		},
		[TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION]: {
			graphic: recipientGraphic,
			bodyFields: [
				{ name: 'mosaics', renderer: 'mosaicAmount' }
			]
		},
		[TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION]: {
			graphic: senderGraphic,
			bodyFields: [
				{ name: 'minApprovalDelta', renderer: 'delta' },
				{ name: 'minRemovalDelta', renderer: 'delta' },
				{ name: 'addressAdditions', renderer: 'account' },
				{ name: 'addressDeletions', renderer: 'account' }
			]
		},
		[TRANSACTION_TYPE.HASH_LOCK]: {
			graphic: {
				target: { name: 'duration', renderer: 'lock', localeKey: 'field_lock' }
			},
			bodyFields: [
				{ name: 'mosaics', renderer: 'mosaicAmount' },
				{ name: 'hash', renderer: 'copy' }
			]
		},
		[TRANSACTION_TYPE.SECRET_LOCK]: {
			graphic: recipientGraphic,
			bodyFields: [
				{ name: 'mosaics', renderer: 'mosaicAmount' },
				{ name: 'duration', renderer: 'text' },
				{ name: 'secret', renderer: 'copy' },
				{ name: 'hashAlgorithm', renderer: 'text' }
			]
		},
		[TRANSACTION_TYPE.SECRET_PROOF]: {
			graphic: recipientGraphic,
			bodyFields: [
				{ name: 'secret', renderer: 'copy' },
				{ name: 'proof', renderer: 'copy' },
				{ name: 'hashAlgorithm', renderer: 'text' }
			]
		},
		[TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION]: {
			graphic: senderGraphic,
			bodyFields: [
				{ name: 'restrictionType', renderer: 'text' },
				{ name: 'restrictionAddressAdditions', renderer: 'account' },
				{ name: 'restrictionAddressDeletions', renderer: 'account' }
			]
		},
		[TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION]: {
			graphic: senderGraphic,
			bodyFields: [
				{ name: 'restrictionType', renderer: 'text' },
				{ name: 'restrictionMosaicAdditions', renderer: 'mosaic' },
				{ name: 'restrictionMosaicDeletions', renderer: 'mosaic' }
			]
		},
		[TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION]: {
			graphic: senderGraphic,
			bodyFields: [
				{ name: 'restrictionType', renderer: 'text' },
				{ name: 'restrictionOperationAdditions', renderer: 'transactionType' },
				{ name: 'restrictionOperationDeletions', renderer: 'transactionType' }
			]
		},
		[TRANSACTION_TYPE.ACCOUNT_KEY_LINK]: {
			graphic: linkedAccountGraphic,
			bodyFields: keyLinkBodyFields
		},
		[TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION]: {
			graphic: targetAddressGraphic,
			bodyFields: [
				{ name: 'mosaicId', renderer: 'mosaic' },
				{ name: 'mosaicAliasNames', renderer: 'text' },
				{ name: 'restrictionKey', renderer: 'text' },
				{ name: 'previousRestrictionValue', renderer: 'text' },
				{ name: 'newRestrictionValue', renderer: 'text' }
			]
		},
		[TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION]: {
			graphic: mosaicGraphic,
			bodyFields: [
				{ name: 'mosaicAliasNames', renderer: 'text' },
				{ name: 'referenceMosaicId', renderer: 'mosaic' },
				{ name: 'restrictionKey', renderer: 'text' },
				{ name: 'previousRestrictionType', renderer: 'translate' },
				{ name: 'previousRestrictionValue', renderer: 'text' },
				{ name: 'newRestrictionType', renderer: 'translate' },
				{ name: 'newRestrictionValue', renderer: 'text' }
			]
		},
		[TRANSACTION_TYPE.ACCOUNT_METADATA]: {
			graphic: targetAddressGraphic,
			bodyFields: metadataBodyFields
		},
		[TRANSACTION_TYPE.MOSAIC_METADATA]: {
			graphic: {
				target: { name: 'targetMosaicId', renderer: 'mosaic', localeKey: 'field_targetMosaic' }
			},
			bodyFields: [
				{ name: 'targetAddress', renderer: 'account' },
				{ name: 'targetMosaicAliasNames', renderer: 'text' },
				...metadataBodyFields
			]
		},
		[TRANSACTION_TYPE.NAMESPACE_METADATA]: {
			graphic: {
				target: { name: 'targetNamespaceId', renderer: 'namespace', localeKey: 'field_targetNamespace' }
			},
			bodyFields: [
				{ name: 'targetAddress', renderer: 'account' },
				{ name: 'namespaceName', renderer: 'text' },
				...metadataBodyFields
			]
		},
		[TRANSACTION_TYPE.VRF_KEY_LINK]: {
			graphic: linkedAccountGraphic,
			bodyFields: keyLinkBodyFields
		},
		[TRANSACTION_TYPE.VOTING_KEY_LINK]: {
			graphic: linkedAccountGraphic,
			bodyFields: [
				...keyLinkBodyFields,
				{ name: 'startEpoch', renderer: 'text' },
				{ name: 'endEpoch', renderer: 'text' }
			]
		},
		[TRANSACTION_TYPE.NODE_KEY_LINK]: {
			graphic: linkedAccountGraphic,
			bodyFields: keyLinkBodyFields
		}
	}
};
