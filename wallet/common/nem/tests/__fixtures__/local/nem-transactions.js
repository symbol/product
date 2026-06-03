import { accounts } from './wallet';
import { nemTimestampToDate } from '../../../src/utils';

// Cases for mapping internal Transaction objects to NEM SDK transactions (transaction-to-nem).
// Each case pairs an input transaction (shaped like the output of TransferModule.createTransaction)
// with the expected `.toJson()` of the resulting NEM SDK transaction. Defining the input and its
// expected serialization side by side keeps each scenario self-documenting.

const { alice, bob } = accounts;

// Public keys are uppercased by the SDK in its JSON output.
const ALICE_PUBLIC_KEY = alice.publicKey.toUpperCase();
const BOB_PUBLIC_KEY = bob.publicKey.toUpperCase();

// Unsigned NEM transactions serialize a zero signature (signing happens later).
const ZERO_SIGNATURE = '0'.repeat(128);

// NEM serializes the recipient as the raw bytes of the base32 address string.
const BOB_RECIPIENT_HEX = '544332353341434B5057434C514C5345524435564A474F49574F4C4246485952444F58364B465737';

// Creation timestamp and expiry deadlines in NEM seconds; standard = +2h, multisig = +48h.
const TIMESTAMP = 254452058;
const STANDARD_DEADLINE = TIMESTAMP + (2 * 3600);
const MULTISIG_DEADLINE = TIMESTAMP + (48 * 3600);

// Wallet deadline objects as produced by createDeadline at compose time (adjusted = SDK-ready NEM seconds).
const standardDeadline = {
	timestamp: nemTimestampToDate(STANDARD_DEADLINE),
	adjusted: { timestamp: TIMESTAMP, deadline: STANDARD_DEADLINE }
};
const multisigDeadline = {
	timestamp: nemTimestampToDate(MULTISIG_DEADLINE),
	adjusted: { timestamp: TIMESTAMP, deadline: MULTISIG_DEADLINE }
};

const createFee = amount => ({ token: { amount, divisibility: 6, id: 'nem.xem', name: 'XEM' } });

const nativeMosaic = amount => ({ id: 'nem.xem', name: 'XEM', amount, divisibility: 6 });

// Transfer of native XEM only.
const transferXem = {
	type: 257,
	signerPublicKey: alice.publicKey,
	recipientAddress: bob.address,
	mosaics: [nativeMosaic('10')],
	message: null,
	fee: createFee('0.1'),
	deadline: standardDeadline
};

const transferXemJson = {
	type: 257,
	version: 2,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: ALICE_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '100000',
	deadline: STANDARD_DEADLINE,
	recipientAddress: BOB_RECIPIENT_HEX,
	amount: '10000000',
	mosaics: []
};

// Transfer carrying a plain-text message. The internal payload keeps a 1-byte type marker, which the
// mapper strips so the SDK receives only the on-chain message bytes.
const transferWithMessage = {
	type: 257,
	signerPublicKey: alice.publicKey,
	recipientAddress: bob.address,
	mosaics: [nativeMosaic('10')],
	message: { type: 1, text: 'Good luck!', payload: '01476f6f64206c75636b21' },
	fee: createFee('0.15'),
	deadline: standardDeadline
};

const transferWithMessageJson = {
	type: 257,
	version: 2,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: ALICE_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '150000',
	deadline: STANDARD_DEADLINE,
	recipientAddress: BOB_RECIPIENT_HEX,
	amount: '10000000',
	message: { messageType: 1, message: '476F6F64206C75636B21' },
	mosaics: []
};

// Transfer carrying a non-native mosaic. The XEM amount field becomes the 1.0 multiplier (1_000_000),
// and each mosaic is serialized as a SizePrefixedMosaic envelope.
const transferWithMosaic = {
	type: 257,
	signerPublicKey: alice.publicKey,
	recipientAddress: bob.address,
	mosaics: [{ id: 'test.token', name: 'test.token', amount: '5', divisibility: 2 }],
	message: null,
	fee: createFee('0.2'),
	deadline: standardDeadline
};

const transferWithMosaicJson = {
	type: 257,
	version: 2,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: ALICE_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '200000',
	deadline: STANDARD_DEADLINE,
	recipientAddress: BOB_RECIPIENT_HEX,
	amount: '1000000',
	mosaics: [{
		mosaic: {
			mosaicId: {
				namespaceId: { name: '74657374' },
				name: '746F6B656E'
			},
			amount: '500'
		}
	}]
};

// Multisig wrapper around an inner XEM transfer. The wrapper uses the 48h multisig deadline, and the
// inner transaction is embedded as a non-verifiable transaction (no signature).
const multisigTransfer = {
	type: 4100,
	signerPublicKey: bob.publicKey,
	fee: createFee('0.15'),
	deadline: multisigDeadline,
	innerTransaction: {
		type: 257,
		signerPublicKey: alice.publicKey,
		recipientAddress: bob.address,
		mosaics: [nativeMosaic('10')],
		message: null,
		fee: createFee('0.1'),
		deadline: standardDeadline
	}
};

const multisigTransferJson = {
	type: 4100,
	version: 1,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: BOB_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '150000',
	deadline: MULTISIG_DEADLINE,
	innerTransaction: {
		type: 257,
		version: 2,
		network: 152,
		timestamp: TIMESTAMP,
		signerPublicKey: ALICE_PUBLIC_KEY,
		fee: '100000',
		deadline: STANDARD_DEADLINE,
		recipientAddress: BOB_RECIPIENT_HEX,
		amount: '10000000',
		mosaics: []
	},
	cosignatures: []
};

export const transactionToNemCases = [
	{ name: 'transfer (XEM only)', transaction: transferXem, expected: transferXemJson },
	{ name: 'transfer with plain message', transaction: transferWithMessage, expected: transferWithMessageJson },
	{ name: 'transfer with mosaic', transaction: transferWithMosaic, expected: transferWithMosaicJson },
	{ name: 'multisig transfer', transaction: multisigTransfer, expected: multisigTransferJson }
];
