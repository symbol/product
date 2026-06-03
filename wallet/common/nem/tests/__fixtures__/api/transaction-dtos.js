import { accounts } from '../local/wallet';

// NEM NIS transaction DTOs as returned by /account/transfers/* and /transaction/get.
// Confirmed transactions are wrapped in a { meta, transaction } pair; unconfirmed transactions
// omit the meta. Each transaction type is defined as a named constant for readability and then
// collected into `transactionDTOs`, index-aligned with the expected `walletTransactions` fixture.

const { alice, bob, carol } = accounts;

// Hex of the plain-text message "Good luck!" (NEM message payloads carry no type-marker byte).
const GOOD_LUCK_PAYLOAD = '476f6f64206c75636b21';

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

export const transactionDTOs = [
	outgoingTransferDTO,
	incomingTransferDTO,
	mosaicTransferDTO,
	encryptedTransferDTO,
	multisigTransferDTO,
	importanceTransferDTO,
	unconfirmedTransferDTO
];
