export const TRANSACTION_TYPE = {
	TRANSFER: 'TRANSFER',
	MOSAIC_CREATION: 'MOSAIC_DEFINITION',
	MOSAIC_SUPPLY_CHANGE: 'MOSAIC_SUPPLY_CHANGE',
	NAMESPACE_REGISTRATION: 'NAMESPACE_REGISTRATION',
	MULTISIG_ACCOUNT_MODIFICATION: 'MULTISIG_ACCOUNT_MODIFICATION',
	ACCOUNT_KEY_LINK: 'ACCOUNT_KEY_LINK',
	MULTISIG: 'MULTISIG'
};

export const TRANSACTION_DIRECTION = {
	INCOMING: 'incoming',
	OUTGOING: 'outgoing'
};

export const ACCOUNT_STATE_CHANGE_ACTION = {
	SEND: 'send',
	RECEIVE: 'receive',
	NONE: 'none',
	BURN: 'burn',
	MINT: 'mint'
};

export const EVENT = {
	ADDRESS_BOOK_UPDATE: 'client.storage.contacts.update',
	TIMESTAMP_TYPE_UPDATE: 'client.storage.timestamp.update'
};

export const STORAGE_KEY = {
	ADDRESS_BOOK: 'ADDRESS_BOOK',
	TIMESTAMP_TYPE: 'TIMESTAMP_TYPE',
	USER_LANGUAGE: 'USER_LANGUAGE',
	USER_CURRENCY: 'USER_CURRENCY'
};

export const SUPPLY_CHANGE_ACTION = {
	INCREASE: 1,
	DECREASE: 2
};

export const COSIGNATORY_MODIFICATION_ACTION = {
	ADDITION: 1,
	REMOVAL: 2
};

export const KEY_LINK_ACTION = {
	LINK: 1,
	UNLINK: 2
};

export const TRANSACTION_CHART_TYPE = {
	BLOCK: 'block',
	DAILY: 'daily',
	MONTHLY: 'monthly'
};