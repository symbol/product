export const TRANSACTION_TYPE = {
	TRANSFER: 'transfer',
	AGGREGATE: 'aggregate',
	MOSAIC_CREATION: 'mosaic_creation'
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
	TIMESTAMP_TYPE: 'TIMESTAMP_TYPE'
};
