/**
 * Mapping of render types to their corresponding object keys
 */
const keyToTypeMap = {
	account: [
		'address',
		'recipientAddress',
		'sender',
		'recipient',
		'signerAddress',
		'senderAddress',
		'transactionInitiator',
		'linkedAccountAddress',
		'targetAddress',
		'sourceAddress',
		'creator',
		'linkedAddress',
		'cosignatories',
		'restrictionAddressAdditions',
		'restrictionAddressDeletions',
		'addressAdditions',
		'receivedCosignatures',
		'addressDeletions',
		'multisigAddresses'
	],
	copy: [
		'id',
		'metadataValue',
		'privateKey',
		'publicKey',
		'vrfPublicKey',
		'remotePublicKey',
		'linkedPublicKey',
		'nodePublicKey',
		'secret',
		'proof',
		'hash',
		'name'
	],
	boolean: [
		'supplyMutable',
		'transferable',
		'restrictable',
		'revokable',
		'isSupplyMutable',
		'isTransferable',
		'isRestrictable',
		'isRevokable'
	],
	fee: [
		'maxFee',
		'rentalFee',
		'transactionFee',
		'fee'
	],
	message: [
		'message'
	],
	token: [
		'mosaic',
		'mosaics',
		'token',
		'tokens'
	],
	encryption: [
		'isMessageEncrypted'
	],
	transactionType: [
		'type',
		'transactionType',
		'restrictionOperationAdditions',
		'restrictionOperationDeletions'
	],
	translate: [
		'registrationType',
		'aliasAction',
		'action',
		'restrictionType',
		'previousRestrictionType',
		'newRestrictionType',
		'linkAction'
	]
};

/**
 * Reverse mapping: key -> type for O(1) lookup
 */
const buildKeyTypeIndex = () => {
	const index = {};

	for (const [type, keys] of Object.entries(keyToTypeMap)) {
		for (const key of keys) 
			index[key] = type;
        
	}

	return index;
};

const keyTypeIndex = buildKeyTypeIndex();

/**
 * Gets the render type for a given object key
 * @param {string} key - Object key
 * @returns {string} Render type
 */
const getTypeForKey = key => keyTypeIndex[key] ?? 'text';

/**
 * Converts an object to table data format for TableView component.
 * Automatically determines the row type based on the object keys.
 *
 * @param {object} obj - Key-value pairs object to convert
 * @returns {import('@/app/types/Table').TableRow[]} Array of table row objects
 */
export const objectToTableData = obj => {
	if (!obj || typeof obj !== 'object') 
		return [];

	return Object.entries(obj)
		.filter(([, value]) => value !== null && value !== undefined)
		.map(([key, value]) => ({
			type: getTypeForKey(key),
			value,
			title: key
		}));
};
