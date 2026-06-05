import { accounts } from './wallet';

// Expected wallet Transaction objects produced by transactionFromDTO for each DTO in
// `transactionDTOs`. Each case is a named constant collected into `walletTransactions`,
// index-aligned with the api fixture.

const { alice, bob, carol } = accounts;

// Outgoing XEM transfer: the native amount is negated because the current account is the sender.
// The message payload is the raw on-chain message bytes (no type marker).
export const outgoingTransfer = {
	type: 257,
	timestamp: 1682039643000,
	deadline: {
		timestamp: 1682043243000,
		adjusted: { timestamp: 254452058, deadline: 254455658 }
	},
	height: 4368990,
	hash: 'a1b2c3',
	fee: '0.1',
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey,
	recipientAddress: bob.address,
	message: {
		type: 'plain',
		text: 'Good luck!',
		payload: '476f6f64206c75636b21',
		native: { type: 1 }
	},
	mosaics: [{
		id: 'nem.xem',
		name: 'XEM',
		amount: '10',
		divisibility: 6
	}],
	amount: '-10'
};

// Incoming XEM transfer: the native amount is positive because the current account is the recipient.
export const incomingTransfer = {
	type: 257,
	timestamp: 1682039685000,
	deadline: {
		timestamp: 1682043285000,
		adjusted: { timestamp: 254452100, deadline: 254455700 }
	},
	height: 4368991,
	hash: 'd4e5f6',
	fee: '0.1',
	signerAddress: bob.address,
	signerPublicKey: bob.publicKey,
	recipientAddress: alice.address,
	mosaics: [{
		id: 'nem.xem',
		name: 'XEM',
		amount: '5',
		divisibility: 6
	}],
	amount: '5'
};

// Mosaic transfer: the resolved mosaic carries the full MosaicInfo (divisibility, supply, flags)
// plus the relative amount. The native XEM amount is '0', so the directed amount is '0'.
export const mosaicTransfer = {
	type: 257,
	timestamp: 1682039785000,
	deadline: {
		timestamp: 1682043385000,
		adjusted: { timestamp: 254452200, deadline: 254455800 }
	},
	height: 4368992,
	hash: 'aa11bb',
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey,
	recipientAddress: bob.address,
	mosaics: [{
		id: 'test.token',
		name: 'test.token',
		divisibility: 2,
		supply: 10000,
		isSupplyMutable: false,
		isTransferable: true,
		amount: '5'
	}],
	amount: '0'
};

// Encrypted transfer: text is null for encrypted messages; payload is the raw on-chain encrypted bytes.
export const encryptedTransfer = {
	type: 257,
	timestamp: 1682039885000,
	deadline: {
		timestamp: 1682043485000,
		adjusted: { timestamp: 254452300, deadline: 254455900 }
	},
	height: 4368993,
	hash: 'cc22dd',
	fee: '0.2',
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey,
	recipientAddress: bob.address,
	message: {
		type: 'encrypted',
		text: null,
		payload: 'deadbeefcafe',
		native: { type: 2 }
	},
	mosaics: [{
		id: 'nem.xem',
		name: 'XEM',
		amount: '0',
		divisibility: 6
	}],
	amount: '0'
};

// Multisig transaction: the inner transfer is mapped as an embedded transaction and surfaced
// through innerTransaction/innerTransactions, while recipient/mosaics/amount mirror the inner one.
export const multisigTransfer = {
	type: 4100,
	timestamp: 1682039985000,
	deadline: {
		timestamp: 1682043585000,
		adjusted: { timestamp: 254452400, deadline: 254456000 }
	},
	height: 4368994,
	hash: 'ee33ff',
	fee: '0.15',
	signerAddress: bob.address,
	signerPublicKey: bob.publicKey,
	innerTransaction: {
		type: 257,
		signerAddress: carol.address,
		signerPublicKey: carol.publicKey,
		recipientAddress: alice.address,
		mosaics: [{
			id: 'nem.xem',
			name: 'XEM',
			amount: '2',
			divisibility: 6
		}],
		amount: '2'
	},
	innerTransactions: [{
		type: 257,
		signerAddress: carol.address,
		signerPublicKey: carol.publicKey,
		recipientAddress: alice.address,
		mosaics: [{
			id: 'nem.xem',
			name: 'XEM',
			amount: '2',
			divisibility: 6
		}],
		amount: '2'
	}],
	recipientAddress: alice.address,
	mosaics: [{
		id: 'nem.xem',
		name: 'XEM',
		amount: '2',
		divisibility: 6
	}],
	amount: '2',
	cosignatures: [{
		signerPublicKey: bob.publicKey,
		signature: 'abcdef',
		signerAddress: bob.address
	}],
	message: null
};

// Importance transfer: an unmodeled type maps to the shared base transaction shape only.
export const importanceTransfer = {
	type: 2049,
	timestamp: 1682040085000,
	deadline: {
		timestamp: 1682043685000,
		adjusted: { timestamp: 254452500, deadline: 254456100 }
	},
	height: 4368995,
	hash: '991122',
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey
};

// Unconfirmed transfer: no meta, so height and hash are null.
export const unconfirmedTransfer = {
	type: 257,
	timestamp: 1682040185000,
	deadline: {
		timestamp: 1682043785000,
		adjusted: { timestamp: 254452600, deadline: 254456200 }
	},
	height: null,
	hash: null,
	fee: '0.1',
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey,
	recipientAddress: bob.address,
	mosaics: [{
		id: 'nem.xem',
		name: 'XEM',
		amount: '3',
		divisibility: 6
	}],
	amount: '-3'
};

export const walletTransactions = [
	outgoingTransfer,
	incomingTransfer,
	mosaicTransfer,
	encryptedTransfer,
	multisigTransfer,
	importanceTransfer,
	unconfirmedTransfer
];
