import { accounts } from '../local/wallet';

// NEM NIS transaction DTOs as returned by /account/transfers/* and /transaction/get.
// Confirmed transactions are wrapped in a { meta, transaction } pair; unconfirmed transactions
// omit the meta. Each transaction type is defined as a named constant for readability and then
// collected into `transactionDTOs`, index-aligned with the expected `walletTransactions` fixture.

const { alice, bob, carol } = accounts;

// Hex of the plain-text message "Good luck!" (NEM message payloads carry no type-marker byte).
const GOOD_LUCK_PAYLOAD = '476f6f64206c75636b21';

const NAMESPACE_FEE_SINK = 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35';
const MOSAIC_FEE_SINK = 'TBMOSAICOD4F54EE5CDMR23CCBGOAM2XSJBR5OLC';

// Outgoing XEM transfer signed by the current account, carrying a plain-text message.
export const outgoingTransferDTO = {
	meta: { height: 4368990, id: 111, hash: { data: 'a1b2c3' } },
	transaction: {
		timeStamp: 254452058,
		amount: 10000000,
		fee: 100000,
		recipient: bob.address,
		type: 257,
		deadline: 254455658,
		message: { payload: GOOD_LUCK_PAYLOAD, type: 1 },
		version: -1744830462,
		signer: alice.publicKey
	}
};

// Incoming XEM transfer received by the current account, without a message.
export const incomingTransferDTO = {
	meta: { height: 4368991, id: 112, hash: { data: 'd4e5f6' } },
	transaction: {
		timeStamp: 254452100,
		amount: 5000000,
		fee: 100000,
		recipient: alice.address,
		type: 257,
		deadline: 254455700,
		version: -1744830462,
		signer: bob.publicKey
	}
};

// Transfer carrying a non-native mosaic. NEM sets the `amount` field to a 1.0 multiplier
// (1_000_000 microXEM) applied to each attached mosaic quantity.
export const mosaicTransferDTO = {
	meta: { height: 4368992, id: 113, hash: { data: 'aa11bb' } },
	transaction: {
		timeStamp: 254452200,
		amount: 1000000,
		fee: 150000,
		recipient: bob.address,
		type: 257,
		deadline: 254455800,
		mosaics: [{ mosaicId: { namespaceId: 'test', name: 'token' }, quantity: 500 }],
		version: -1744830462,
		signer: alice.publicKey
	}
};

// Transfer carrying an encrypted message (type 2). The decoded text is null for encrypted messages.
export const encryptedTransferDTO = {
	meta: { height: 4368993, id: 114, hash: { data: 'cc22dd' } },
	transaction: {
		timeStamp: 254452300,
		amount: 0,
		fee: 200000,
		recipient: bob.address,
		type: 257,
		deadline: 254455900,
		message: { payload: 'deadbeefcafe', type: 2 },
		version: -1744830462,
		signer: alice.publicKey
	}
};

// Multisig transaction (type 4100) wrapping an inner XEM transfer (otherTrans) with one cosignature.
export const multisigTransferDTO = {
	meta: { height: 4368994, id: 115, hash: { data: 'ee33ff' } },
	transaction: {
		timeStamp: 254452400,
		fee: 150000,
		type: 4100,
		deadline: 254456000,
		version: -1744830462,
		signer: bob.publicKey,
		otherTrans: {
			timeStamp: 254452400,
			amount: 2000000,
			fee: 100000,
			recipient: alice.address,
			type: 257,
			deadline: 254456000,
			version: -1744830462,
			signer: carol.publicKey
		},
		signatures: [{
			timeStamp: 254452450,
			otherHash: { data: 'ee33ff' },
			otherAccount: alice.address,
			fee: 150000,
			type: 4098,
			deadline: 254456050,
			version: -1744830462,
			signer: bob.publicKey,
			signature: 'abcdef'
		}]
	}
};

// Importance transfer (type 2049) — a type the mapper does not model specially, so it maps to the
// shared base transaction shape only.
export const importanceTransferDTO = {
	meta: { height: 4368995, id: 116, hash: { data: '991122' } },
	transaction: {
		timeStamp: 254452500,
		fee: 150000,
		type: 2049,
		deadline: 254456100,
		version: -1744830462,
		signer: alice.publicKey,
		mode: 1,
		remoteAccount: bob.publicKey
	}
};

// Unconfirmed outgoing transfer — no meta, so height and hash resolve to null.
export const unconfirmedTransferDTO = {
	transaction: {
		timeStamp: 254452600,
		amount: 3000000,
		fee: 100000,
		recipient: bob.address,
		type: 257,
		deadline: 254456200,
		version: -1744830462,
		signer: alice.publicKey
	}
};

// Multisig account modification (type 4097) adding bob and removing carol, raising the minimum
// cosignatories by one. NIS names the cosignatory public key `cosignatoryAccount` and carries the
// minimum-cosignatories change under `minCosignatories.relativeChange`.
export const multisigModificationDTO = {
	meta: { height: 4368996, id: 117, hash: { data: '112233' } },
	transaction: {
		timeStamp: 254452700,
		fee: 500000,
		type: 4097,
		deadline: 254456300,
		version: -1744830462,
		signer: alice.publicKey,
		modifications: [
			{ modificationType: 1, cosignatoryAccount: bob.publicKey },
			{ modificationType: 2, cosignatoryAccount: carol.publicKey }
		],
		minCosignatories: { relativeChange: 1 }
	}
};

// Standalone cosignature (type 4098) signing the hash of a pending multisig transaction. `otherHash`
// is the cosigned inner transaction hash and `otherAccount` is the multisig account address.
export const cosignatureDTO = {
	meta: { height: 4368997, id: 118, hash: { data: '445566' } },
	transaction: {
		timeStamp: 254452800,
		fee: 150000,
		type: 4098,
		deadline: 254456400,
		version: -1744830462,
		signer: bob.publicKey,
		otherHash: { data: 'cc317a7674d56352b4c711096a7594bd11908bf518293a191fc2faa12eac0fbb' },
		otherAccount: alice.address
	}
};

// Root namespace provisioning (type 8193): no parent, and the rental fee (100 XEM) is paid to the
// namespace fee sink. NIS names the new namespace part `newPart`.
export const namespaceRegistrationDTO = {
	meta: { height: 4368998, id: 119, hash: { data: '778899' } },
	transaction: {
		timeStamp: 254452900,
		fee: 150000,
		type: 8193,
		deadline: 254456500,
		version: -1744830463,
		signer: alice.publicKey,
		rentalFeeSink: NAMESPACE_FEE_SINK,
		rentalFee: 100000000,
		newPart: 'alice',
		parent: null
	}
};

// Sub-namespace provisioning (type 8193): a parent is set and the rental fee is 10 XEM.
export const subNamespaceRegistrationDTO = {
	meta: { height: 4368999, id: 120, hash: { data: 'aabbcc' } },
	transaction: {
		timeStamp: 254453000,
		fee: 150000,
		type: 8193,
		deadline: 254456600,
		version: -1744830463,
		signer: alice.publicKey,
		rentalFeeSink: NAMESPACE_FEE_SINK,
		rentalFee: 10000000,
		newPart: 'vouchers',
		parent: 'alice'
	}
};

// Mosaic definition (type 16385) without a levy: NIS serializes the absent levy as an empty object,
// names the owner `creator`, the creation fee sink `creationFeeSink`, and the fee `creationFee`.
export const mosaicDefinitionDTO = {
	meta: { height: 4369000, id: 121, hash: { data: 'ddeeff' } },
	transaction: {
		timeStamp: 254453100,
		fee: 150000,
		type: 16385,
		deadline: 254456700,
		version: -1744830463,
		signer: alice.publicKey,
		creationFee: 10000000,
		creationFeeSink: MOSAIC_FEE_SINK,
		mosaicDefinition: {
			creator: alice.publicKey,
			description: 'gift vouchers',
			id: { namespaceId: 'alice', name: 'token' },
			properties: [
				{ name: 'divisibility', value: '3' },
				{ name: 'initialSupply', value: '1000' },
				{ name: 'supplyMutable', value: 'false' },
				{ name: 'transferable', value: 'true' }
			],
			levy: {}
		}
	}
};

// Mosaic definition (type 16385) with an absolute levy paid in XEM to another account.
export const mosaicDefinitionWithLevyDTO = {
	meta: { height: 4369001, id: 122, hash: { data: '123456' } },
	transaction: {
		timeStamp: 254453200,
		fee: 150000,
		type: 16385,
		deadline: 254456800,
		version: -1744830463,
		signer: alice.publicKey,
		creationFee: 10000000,
		creationFeeSink: MOSAIC_FEE_SINK,
		mosaicDefinition: {
			creator: alice.publicKey,
			description: 'levied token',
			id: { namespaceId: 'alice', name: 'levied' },
			properties: [
				{ name: 'divisibility', value: '0' },
				{ name: 'initialSupply', value: '100' },
				{ name: 'supplyMutable', value: 'false' },
				{ name: 'transferable', value: 'true' }
			],
			levy: { type: 1, recipient: bob.address, mosaicId: { namespaceId: 'nem', name: 'xem' }, fee: 1000 }
		}
	}
};

// Mosaic supply change (type 16386): increase (`supplyType` 1) the supply by a delta. NIS carries the
// mosaic id as a `{ namespaceId, name }` pair.
export const mosaicSupplyChangeDTO = {
	meta: { height: 4369002, id: 123, hash: { data: '789abc' } },
	transaction: {
		timeStamp: 254453300,
		fee: 150000,
		type: 16386,
		deadline: 254456900,
		version: -1744830463,
		signer: alice.publicKey,
		supplyType: 1,
		delta: 1000,
		mosaicId: { namespaceId: 'alice', name: 'token' }
	}
};

// Multisig transaction (type 4100) wrapping a non-transfer inner transaction (an importance transfer)
// with no cosignatures yet. Confirms the embedded path of the newly-mapped inner types.
export const multisigImportanceTransferDTO = {
	meta: { height: 4369003, id: 124, hash: { data: 'def012' } },
	transaction: {
		timeStamp: 254453400,
		fee: 150000,
		type: 4100,
		deadline: 254457000,
		version: -1744830462,
		signer: bob.publicKey,
		otherTrans: {
			timeStamp: 254453400,
			fee: 150000,
			type: 2049,
			deadline: 254457000,
			version: -1744830462,
			signer: alice.publicKey,
			mode: 1,
			remoteAccount: carol.publicKey
		},
		signatures: []
	}
};

export const transactionDTOs = [
	outgoingTransferDTO,
	incomingTransferDTO,
	mosaicTransferDTO,
	encryptedTransferDTO,
	multisigTransferDTO,
	importanceTransferDTO,
	unconfirmedTransferDTO,
	multisigModificationDTO,
	cosignatureDTO,
	namespaceRegistrationDTO,
	subNamespaceRegistrationDTO,
	mosaicDefinitionDTO,
	mosaicDefinitionWithLevyDTO,
	mosaicSupplyChangeDTO,
	multisigImportanceTransferDTO
];
