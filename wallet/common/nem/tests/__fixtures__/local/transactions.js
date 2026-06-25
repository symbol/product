import { accounts } from './wallet';

const { alice, bob, carol } = accounts;

const NAMESPACE_FEE_SINK = 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35';
const MOSAIC_FEE_SINK = 'TBMOSAICOD4F54EE5CDMR23CCBGOAM2XSJBR5OLC';

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

// Importance transfer (modelled as an account key link): `mode` becomes the linkAction and
// `remoteAccount` becomes the remote public key, with its address derived from that public key.
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
	signerPublicKey: alice.publicKey,
	linkAction: 1,
	remotePublicKey: bob.publicKey,
	remoteAccountAddress: bob.address
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

// Multisig account modification: cosignatory changes keyed by public key, plus the minimum
// cosignatories delta surfaced as minApprovalDelta.
export const multisigModification = {
	type: 4097,
	timestamp: 1682040285000,
	deadline: {
		timestamp: 1682043885000,
		adjusted: { timestamp: 254452700, deadline: 254456300 }
	},
	height: 4368996,
	hash: '112233',
	fee: '0.5',
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey,
	modifications: [
		{ modificationType: 1, cosignatoryPublicKey: bob.publicKey },
		{ modificationType: 2, cosignatoryPublicKey: carol.publicKey }
	],
	minApprovalDelta: 1
};

// Standalone cosignature: the cosigned inner transaction hash and the multisig account address.
export const cosignature = {
	type: 4098,
	timestamp: 1682040385000,
	deadline: {
		timestamp: 1682043985000,
		adjusted: { timestamp: 254452800, deadline: 254456400 }
	},
	height: 4368997,
	hash: '445566',
	fee: '0.15',
	signerAddress: bob.address,
	signerPublicKey: bob.publicKey,
	otherTransactionHash: 'cc317a7674d56352b4c711096a7594bd11908bf518293a191fc2faa12eac0fbb',
	multisigAccountAddress: alice.address
};

// Root namespace registration: parentName is null and the namespace id is the bare name.
export const namespaceRegistration = {
	type: 8193,
	timestamp: 1682040485000,
	deadline: {
		timestamp: 1682044085000,
		adjusted: { timestamp: 254452900, deadline: 254456500 }
	},
	height: 4368998,
	hash: '778899',
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey,
	namespaceName: 'alice',
	parentName: null,
	namespaceId: 'alice',
	rentalFeeSink: NAMESPACE_FEE_SINK,
	rentalFee: '100'
};

// Sub-namespace registration: parentName is set and the namespace id is 'parent.name'.
export const subNamespaceRegistration = {
	type: 8193,
	timestamp: 1682040585000,
	deadline: {
		timestamp: 1682044185000,
		adjusted: { timestamp: 254453000, deadline: 254456600 }
	},
	height: 4368999,
	hash: 'aabbcc',
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey,
	namespaceName: 'vouchers',
	parentName: 'alice',
	namespaceId: 'alice.vouchers',
	rentalFeeSink: NAMESPACE_FEE_SINK,
	rentalFee: '10'
};

// Mosaic definition without a levy: properties are parsed into the typed shape and levy is null.
export const mosaicDefinition = {
	type: 16385,
	timestamp: 1682040685000,
	deadline: {
		timestamp: 1682044285000,
		adjusted: { timestamp: 254453100, deadline: 254456700 }
	},
	height: 4369000,
	hash: 'ddeeff',
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey,
	mosaicDefinition: {
		id: 'alice.token',
		ownerPublicKey: alice.publicKey,
		description: 'gift vouchers',
		properties: { divisibility: 3, initialSupply: 1000, supplyMutable: false, transferable: true },
		levy: null
	},
	rentalFeeSink: MOSAIC_FEE_SINK,
	rentalFee: '10'
};

// Mosaic definition with an absolute levy: the levy recipient is surfaced as an address and its
// mosaic id as a 'namespace.name' string.
export const mosaicDefinitionWithLevy = {
	type: 16385,
	timestamp: 1682040785000,
	deadline: {
		timestamp: 1682044385000,
		adjusted: { timestamp: 254453200, deadline: 254456800 }
	},
	height: 4369001,
	hash: '123456',
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey,
	mosaicDefinition: {
		id: 'alice.levied',
		ownerPublicKey: alice.publicKey,
		description: 'levied token',
		properties: { divisibility: 0, initialSupply: 100, supplyMutable: false, transferable: true },
		levy: { type: 1, recipientAddress: bob.address, mosaicId: 'nem.xem', fee: 1000 }
	},
	rentalFeeSink: MOSAIC_FEE_SINK,
	rentalFee: '10'
};

// Mosaic supply change: supplyType becomes the action and the mosaic id becomes a 'namespace.name' string.
export const mosaicSupplyChange = {
	type: 16386,
	timestamp: 1682040885000,
	deadline: {
		timestamp: 1682044485000,
		adjusted: { timestamp: 254453300, deadline: 254456900 }
	},
	height: 4369002,
	hash: '789abc',
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey,
	mosaicId: 'alice.token',
	action: 1,
	delta: 1000
};

// Multisig wrapping an importance transfer: the inner transaction is mapped as an embedded account
// key link, and recipient/mosaics/amount mirror the (non-transfer) inner one.
const multisigImportanceInner = {
	type: 2049,
	signerAddress: alice.address,
	signerPublicKey: alice.publicKey,
	linkAction: 1,
	remotePublicKey: carol.publicKey,
	remoteAccountAddress: carol.address
};

export const multisigImportanceTransfer = {
	type: 4100,
	timestamp: 1682040985000,
	deadline: {
		timestamp: 1682044585000,
		adjusted: { timestamp: 254453400, deadline: 254457000 }
	},
	height: 4369003,
	hash: 'def012',
	fee: '0.15',
	signerAddress: bob.address,
	signerPublicKey: bob.publicKey,
	innerTransaction: multisigImportanceInner,
	innerTransactions: [multisigImportanceInner],
	recipientAddress: null,
	mosaics: [],
	amount: '0',
	cosignatures: [],
	message: null
};

export const walletTransactions = [
	outgoingTransfer,
	incomingTransfer,
	mosaicTransfer,
	encryptedTransfer,
	multisigTransfer,
	importanceTransfer,
	unconfirmedTransfer,
	multisigModification,
	cosignature,
	namespaceRegistration,
	subNamespaceRegistration,
	mosaicDefinition,
	mosaicDefinitionWithLevy,
	mosaicSupplyChange,
	multisigImportanceTransfer
];
