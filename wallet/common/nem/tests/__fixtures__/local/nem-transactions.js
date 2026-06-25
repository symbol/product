import { accounts } from './wallet';
import { nemTimestampToDate } from '../../../src/utils';

// Cases for mapping internal Transaction objects to NEM SDK transactions (transaction-to-nem).
// Each case pairs an input transaction (shaped like the output of TransferModule.createTransaction)
// with the expected `.toJson()` of the resulting NEM SDK transaction. Defining the input and its
// expected serialization side by side keeps each scenario self-documenting.

const { alice, bob, carol } = accounts;

// Public keys are uppercased by the SDK in its JSON output.
const ALICE_PUBLIC_KEY = alice.publicKey.toUpperCase();
const BOB_PUBLIC_KEY = bob.publicKey.toUpperCase();
const CAROL_PUBLIC_KEY = carol.publicKey.toUpperCase();

// Unsigned NEM transactions serialize a zero signature (signing happens later).
const ZERO_SIGNATURE = '0'.repeat(128);

// NEM serializes addresses as the raw bytes of the base32 address string.
const BOB_RECIPIENT_HEX = '544332353341434B5057434C514C5345524435564A474F49574F4C4246485952444F58364B465737';
const ALICE_ADDRESS_HEX = '544334374D43333654524151375A525748545937324832423341454B434C4D4C5446564E59334D34';

// NEM fee sinks (testnet).
const NAMESPACE_FEE_SINK = 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35';
const NAMESPACE_FEE_SINK_HEX = '54414D4553504143455748344D4B464D42435646455244504F4F5034464B374D54444A4559503335';
const MOSAIC_FEE_SINK = 'TBMOSAICOD4F54EE5CDMR23CCBGOAM2XSJBR5OLC';
const MOSAIC_FEE_SINK_HEX = '54424D4F534149434F443446353445453543444D523233434342474F414D3258534A4252354F4C43';

// Hash of the cosigned inner transaction (lowercase input; the SDK uppercases it in JSON output).
const OTHER_TRANSACTION_HASH = 'cc317a7674d56352b4c711096a7594bd11908bf518293a191fc2faa12eac0fbb';
const OTHER_TRANSACTION_HASH_UPPER = OTHER_TRANSACTION_HASH.toUpperCase();

// Mosaic id 'alice.token' and namespace parts, byte-encoded as the SDK serializes them.
const ALICE_NAME_HEX = '616C696365';
const TOKEN_NAME_HEX = '746F6B656E';
const VOUCHERS_NAME_HEX = '766F756368657273';

// Creation timestamp and expiry deadlines in NEM seconds; standard = +2h, multisig = +24h.
const TIMESTAMP = 254452058;
const STANDARD_DEADLINE = TIMESTAMP + (2 * 3600);
const MULTISIG_DEADLINE = TIMESTAMP + (24 * 3600);

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

// Transfer carrying a plain-text message. payload is the raw on-chain message bytes (no type marker);
// the native message-type code is carried in message.native.type.
const transferWithMessage = {
	type: 257,
	signerPublicKey: alice.publicKey,
	recipientAddress: bob.address,
	mosaics: [nativeMosaic('10')],
	message: { type: 'plain', text: 'Good luck!', payload: '476f6f64206c75636b21', native: { type: 1 } },
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

// Transfer carrying a sub-namespace mosaic ('makoto.metals.silver').
const transferWithSubNamespaceMosaic = {
	type: 257,
	signerPublicKey: alice.publicKey,
	recipientAddress: bob.address,
	mosaics: [{ id: 'makoto.metals.silver', name: 'makoto.metals.silver', amount: '5', divisibility: 2 }],
	message: null,
	fee: createFee('0.2'),
	deadline: standardDeadline
};

const transferWithSubNamespaceMosaicJson = {
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
				namespaceId: { name: '6D616B6F746F2E6D6574616C73' },
				name: '73696C766572'
			},
			amount: '500'
		}
	}]
};

// Multisig wrapper around an inner XEM transfer. The wrapper uses the 24h multisig deadline, and the
// inner transaction is embedded as a non-verifiable transaction (no signature).
export const multisigTransfer = {
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

// Importance transfer (delegated harvesting), modelled by the SDK as an account key link.
export const importanceTransfer = {
	type: 2049,
	signerPublicKey: alice.publicKey,
	fee: createFee('0.15'),
	deadline: standardDeadline,
	linkAction: 1,
	remotePublicKey: carol.publicKey
};

const importanceTransferJson = {
	type: 2049,
	version: 1,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: ALICE_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '150000',
	deadline: STANDARD_DEADLINE,
	linkAction: 1,
	remotePublicKey: CAROL_PUBLIC_KEY
};

// Multisig account modification uses the latest v2 descriptor; omitting the delta defaults it to 0.
export const multisigModification = {
	type: 4097,
	signerPublicKey: alice.publicKey,
	fee: createFee('0.5'),
	deadline: standardDeadline,
	modifications: [
		{ modificationType: 1, cosignatoryPublicKey: bob.publicKey },
		{ modificationType: 2, cosignatoryPublicKey: carol.publicKey }
	]
};

const multisigModificationJson = {
	type: 4097,
	version: 2,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: ALICE_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '500000',
	deadline: STANDARD_DEADLINE,
	modifications: [
		{ modification: { modificationType: 1, cosignatoryPublicKey: BOB_PUBLIC_KEY } },
		{ modification: { modificationType: 2, cosignatoryPublicKey: CAROL_PUBLIC_KEY } }
	],
	minApprovalDelta: 0
};

// Multisig account modification still uses v2 when a min-cosignatories delta is supplied.
const multisigModificationWithDelta = {
	type: 4097,
	signerPublicKey: alice.publicKey,
	fee: createFee('0.5'),
	deadline: standardDeadline,
	minApprovalDelta: 1,
	modifications: [{ modificationType: 1, cosignatoryPublicKey: bob.publicKey }]
};

const multisigModificationWithDeltaJson = {
	type: 4097,
	version: 2,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: ALICE_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '500000',
	deadline: STANDARD_DEADLINE,
	modifications: [{ modification: { modificationType: 1, cosignatoryPublicKey: BOB_PUBLIC_KEY } }],
	minApprovalDelta: 1
};

// Cosignature: a standalone transaction signing the hash of a pending multisig transaction.
export const cosignature = {
	type: 4098,
	signerPublicKey: bob.publicKey,
	fee: createFee('0.15'),
	deadline: standardDeadline,
	otherTransactionHash: OTHER_TRANSACTION_HASH,
	multisigAccountAddress: alice.address
};

const cosignatureJson = {
	type: 4098,
	version: 1,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: BOB_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '150000',
	deadline: STANDARD_DEADLINE,
	otherTransactionHash: OTHER_TRANSACTION_HASH_UPPER,
	multisigAccountAddress: ALICE_ADDRESS_HEX
};

// Root namespace provisioning: rental fee is 100 XEM and there is no parent.
export const namespaceRoot = {
	type: 8193,
	signerPublicKey: alice.publicKey,
	fee: createFee('0.15'),
	deadline: standardDeadline,
	rentalFeeSink: NAMESPACE_FEE_SINK,
	rentalFee: createFee('100'),
	namespaceName: 'alice'
};

const namespaceRootJson = {
	type: 8193,
	version: 1,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: ALICE_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '150000',
	deadline: STANDARD_DEADLINE,
	rentalFeeSink: NAMESPACE_FEE_SINK_HEX,
	rentalFee: '100000000',
	name: ALICE_NAME_HEX
};

// Sub-namespace provisioning: a parent is set and the rental fee is 10 XEM.
const namespaceSub = {
	type: 8193,
	signerPublicKey: alice.publicKey,
	fee: createFee('0.15'),
	deadline: standardDeadline,
	rentalFeeSink: NAMESPACE_FEE_SINK,
	rentalFee: createFee('10'),
	namespaceName: 'vouchers',
	parentName: 'alice'
};

const namespaceSubJson = {
	type: 8193,
	version: 1,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: ALICE_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '150000',
	deadline: STANDARD_DEADLINE,
	rentalFeeSink: NAMESPACE_FEE_SINK_HEX,
	rentalFee: '10000000',
	name: VOUCHERS_NAME_HEX,
	parentName: ALICE_NAME_HEX
};

// Mosaic definition without a levy: properties are byte-encoded name/value pairs.
export const mosaicDefinition = {
	type: 16385,
	signerPublicKey: alice.publicKey,
	fee: createFee('0.15'),
	deadline: standardDeadline,
	rentalFeeSink: MOSAIC_FEE_SINK,
	rentalFee: createFee('10'),
	mosaicDefinition: {
		id: 'alice.token',
		description: 'gift vouchers',
		properties: { divisibility: 3, initialSupply: 1000, supplyMutable: false, transferable: true }
	}
};

const mosaicDefinitionJson = {
	type: 16385,
	version: 1,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: ALICE_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '150000',
	deadline: STANDARD_DEADLINE,
	mosaicDefinition: {
		ownerPublicKey: ALICE_PUBLIC_KEY,
		id: { namespaceId: { name: ALICE_NAME_HEX }, name: TOKEN_NAME_HEX },
		description: '6769667420766F756368657273',
		properties: [
			{ property: { name: '64697669736962696C697479', value: '33' } },
			{ property: { name: '696E697469616C537570706C79', value: '31303030' } },
			{ property: { name: '737570706C794D757461626C65', value: '66616C7365' } },
			{ property: { name: '7472616E7366657261626C65', value: '74727565' } }
		]
	},
	rentalFeeSink: MOSAIC_FEE_SINK_HEX,
	rentalFee: '10000000'
};

// Mosaic definition with an absolute levy paid in XEM to another account.
const mosaicDefinitionWithLevy = {
	type: 16385,
	signerPublicKey: alice.publicKey,
	fee: createFee('0.15'),
	deadline: standardDeadline,
	rentalFeeSink: MOSAIC_FEE_SINK,
	rentalFee: createFee('10'),
	mosaicDefinition: {
		id: 'alice.token',
		description: 'gift vouchers',
		properties: { divisibility: 0, initialSupply: 100 },
		levy: { type: 1, recipientAddress: bob.address, mosaicId: 'nem.xem', fee: 1000 }
	}
};

const mosaicDefinitionWithLevyJson = {
	type: 16385,
	version: 1,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: ALICE_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '150000',
	deadline: STANDARD_DEADLINE,
	mosaicDefinition: {
		ownerPublicKey: ALICE_PUBLIC_KEY,
		id: { namespaceId: { name: ALICE_NAME_HEX }, name: TOKEN_NAME_HEX },
		description: '6769667420766F756368657273',
		properties: [
			{ property: { name: '64697669736962696C697479', value: '30' } },
			{ property: { name: '696E697469616C537570706C79', value: '313030' } }
		],
		levy: {
			transferFeeType: 1,
			recipientAddress: BOB_RECIPIENT_HEX,
			mosaicId: { namespaceId: { name: '6E656D' }, name: '78656D' },
			fee: '1000'
		}
	},
	rentalFeeSink: MOSAIC_FEE_SINK_HEX,
	rentalFee: '10000000'
};

// Mosaic supply change: increase the supply of a mosaic by a delta.
export const mosaicSupplyChange = {
	type: 16386,
	signerPublicKey: alice.publicKey,
	fee: createFee('0.15'),
	deadline: standardDeadline,
	mosaicId: 'alice.token',
	action: 1,
	delta: 1000
};

const mosaicSupplyChangeJson = {
	type: 16386,
	version: 1,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: ALICE_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '150000',
	deadline: STANDARD_DEADLINE,
	mosaicId: { namespaceId: { name: ALICE_NAME_HEX }, name: TOKEN_NAME_HEX },
	action: 1,
	delta: '1000'
};

// Multisig wrapper around a non-transfer inner transaction (an importance transfer).
const multisigImportanceTransfer = {
	type: 4100,
	signerPublicKey: bob.publicKey,
	fee: createFee('0.15'),
	deadline: multisigDeadline,
	innerTransaction: {
		type: 2049,
		signerPublicKey: alice.publicKey,
		fee: createFee('0.15'),
		deadline: standardDeadline,
		linkAction: 1,
		remotePublicKey: carol.publicKey
	}
};

const multisigImportanceTransferJson = {
	type: 4100,
	version: 1,
	network: 152,
	timestamp: TIMESTAMP,
	signerPublicKey: BOB_PUBLIC_KEY,
	signature: ZERO_SIGNATURE,
	fee: '150000',
	deadline: MULTISIG_DEADLINE,
	innerTransaction: {
		type: 2049,
		version: 1,
		network: 152,
		timestamp: TIMESTAMP,
		signerPublicKey: ALICE_PUBLIC_KEY,
		fee: '150000',
		deadline: STANDARD_DEADLINE,
		linkAction: 1,
		remotePublicKey: CAROL_PUBLIC_KEY
	},
	cosignatures: []
};

export const transactionToNemCases = [
	{ name: 'transfer (XEM only)', transaction: transferXem, expected: transferXemJson },
	{ name: 'transfer with plain message', transaction: transferWithMessage, expected: transferWithMessageJson },
	{ name: 'transfer with mosaic', transaction: transferWithMosaic, expected: transferWithMosaicJson },
	{
		name: 'transfer with sub-namespace mosaic',
		transaction: transferWithSubNamespaceMosaic,
		expected: transferWithSubNamespaceMosaicJson
	},
	{ name: 'multisig transfer', transaction: multisigTransfer, expected: multisigTransferJson },
	{ name: 'importance transfer', transaction: importanceTransfer, expected: importanceTransferJson },
	{ name: 'multisig account modification (default delta)', transaction: multisigModification, expected: multisigModificationJson },
	{
		name: 'multisig account modification (v2, min approval delta)',
		transaction: multisigModificationWithDelta,
		expected: multisigModificationWithDeltaJson
	},
	{ name: 'cosignature', transaction: cosignature, expected: cosignatureJson },
	{ name: 'namespace registration (root)', transaction: namespaceRoot, expected: namespaceRootJson },
	{ name: 'namespace registration (sub)', transaction: namespaceSub, expected: namespaceSubJson },
	{ name: 'mosaic definition', transaction: mosaicDefinition, expected: mosaicDefinitionJson },
	{ name: 'mosaic definition with levy', transaction: mosaicDefinitionWithLevy, expected: mosaicDefinitionWithLevyJson },
	{ name: 'mosaic supply change', transaction: mosaicSupplyChange, expected: mosaicSupplyChangeJson },
	{ name: 'multisig importance transfer', transaction: multisigImportanceTransfer, expected: multisigImportanceTransferJson }
];

// Cases for mapping NEM SDK transactions back to internal Transaction objects (transaction-from-nem).
// Each `transaction` is the same internal input fed to transaction-to-nem above; the test builds the SDK
// model with transactionToNem and asserts that transaction-from-nem reconstructs the `expected` object.
// Read with currentAccount = alice (so alice-signed transfers resolve as outgoing) and a mosaicInfos map
// that resolves the non-native 'test.token' mosaic.

// transaction-from-nem returns the creation timestamp (Unix ms) and the same deadline object shape.
const CREATION_TIMESTAMP_MS = nemTimestampToDate(TIMESTAMP);

const resolvedTestToken = { id: 'test.token', name: 'Test Token', divisibility: 2, supply: 1000, amount: '5' };

const transferXemRead = {
	type: 257,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: standardDeadline,
	fee: '0.1',
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	recipientAddress: bob.address,
	mosaics: [nativeMosaic('10')],
	amount: '-10'
};

const transferWithMessageRead = {
	...transferXemRead,
	fee: '0.15',
	message: { type: 'plain', text: 'Good luck!', payload: '476f6f64206c75636b21', native: { type: 1 } }
};

const transferWithMosaicRead = {
	type: 257,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: standardDeadline,
	fee: '0.2',
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	recipientAddress: bob.address,
	mosaics: [resolvedTestToken],
	amount: '0'
};

const importanceTransferRead = {
	type: 2049,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: standardDeadline,
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	linkAction: 1,
	remotePublicKey: CAROL_PUBLIC_KEY,
	remoteAccountAddress: carol.address
};

const multisigModificationRead = {
	type: 4097,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: standardDeadline,
	fee: '0.5',
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	modifications: [
		{ modificationType: 1, cosignatoryPublicKey: BOB_PUBLIC_KEY },
		{ modificationType: 2, cosignatoryPublicKey: CAROL_PUBLIC_KEY }
	],
	minApprovalDelta: 0
};

const multisigModificationWithDeltaRead = {
	type: 4097,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: standardDeadline,
	fee: '0.5',
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	modifications: [{ modificationType: 1, cosignatoryPublicKey: BOB_PUBLIC_KEY }],
	minApprovalDelta: 1
};

const cosignatureRead = {
	type: 4098,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: standardDeadline,
	fee: '0.15',
	signerAddress: bob.address,
	signerPublicKey: BOB_PUBLIC_KEY,
	otherTransactionHash: OTHER_TRANSACTION_HASH_UPPER,
	multisigAccountAddress: alice.address
};

const namespaceRootRead = {
	type: 8193,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: standardDeadline,
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	namespaceName: 'alice',
	parentName: null,
	namespaceId: 'alice',
	rentalFeeSink: NAMESPACE_FEE_SINK,
	rentalFee: '100'
};

const namespaceSubRead = {
	type: 8193,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: standardDeadline,
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	namespaceName: 'vouchers',
	parentName: 'alice',
	namespaceId: 'alice.vouchers',
	rentalFeeSink: NAMESPACE_FEE_SINK,
	rentalFee: '10'
};

const mosaicDefinitionRead = {
	type: 16385,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: standardDeadline,
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	mosaicDefinition: {
		id: 'alice.token',
		ownerPublicKey: ALICE_PUBLIC_KEY,
		description: 'gift vouchers',
		properties: { divisibility: 3, initialSupply: 1000, supplyMutable: false, transferable: true },
		levy: null
	},
	rentalFeeSink: MOSAIC_FEE_SINK,
	rentalFee: '10'
};

const mosaicDefinitionWithLevyRead = {
	type: 16385,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: standardDeadline,
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	mosaicDefinition: {
		id: 'alice.token',
		ownerPublicKey: ALICE_PUBLIC_KEY,
		description: 'gift vouchers',
		properties: { divisibility: 0, initialSupply: 100, supplyMutable: false, transferable: true },
		levy: { type: 1, recipientAddress: bob.address, mosaicId: 'nem.xem', fee: 1000 }
	},
	rentalFeeSink: MOSAIC_FEE_SINK,
	rentalFee: '10'
};

const mosaicSupplyChangeRead = {
	type: 16386,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: standardDeadline,
	fee: '0.15',
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	mosaicId: 'alice.token',
	action: 1,
	delta: 1000
};

const multisigTransferInnerRead = {
	type: 257,
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	recipientAddress: bob.address,
	mosaics: [nativeMosaic('10')],
	amount: '-10'
};

const multisigTransferRead = {
	type: 4100,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: multisigDeadline,
	fee: '0.15',
	signerAddress: bob.address,
	signerPublicKey: BOB_PUBLIC_KEY,
	innerTransaction: multisigTransferInnerRead,
	innerTransactions: [multisigTransferInnerRead],
	recipientAddress: bob.address,
	mosaics: [nativeMosaic('10')],
	amount: '-10',
	cosignatures: [],
	message: null
};

const multisigImportanceTransferInnerRead = {
	type: 2049,
	signerAddress: alice.address,
	signerPublicKey: ALICE_PUBLIC_KEY,
	linkAction: 1,
	remotePublicKey: CAROL_PUBLIC_KEY,
	remoteAccountAddress: carol.address
};

const multisigImportanceTransferRead = {
	type: 4100,
	timestamp: CREATION_TIMESTAMP_MS,
	deadline: multisigDeadline,
	fee: '0.15',
	signerAddress: bob.address,
	signerPublicKey: BOB_PUBLIC_KEY,
	innerTransaction: multisigImportanceTransferInnerRead,
	innerTransactions: [multisigImportanceTransferInnerRead],
	recipientAddress: null,
	mosaics: [],
	amount: '0',
	cosignatures: [],
	message: null
};

export const transactionFromNemCases = [
	{ name: 'transfer (XEM only)', transaction: transferXem, expected: transferXemRead },
	{ name: 'transfer with plain message', transaction: transferWithMessage, expected: transferWithMessageRead },
	{ name: 'transfer with mosaic', transaction: transferWithMosaic, expected: transferWithMosaicRead },
	{ name: 'multisig transfer', transaction: multisigTransfer, expected: multisigTransferRead },
	{ name: 'importance transfer', transaction: importanceTransfer, expected: importanceTransferRead },
	{ name: 'multisig account modification (default delta)', transaction: multisigModification, expected: multisigModificationRead },
	{
		name: 'multisig account modification (v2, min approval delta)',
		transaction: multisigModificationWithDelta,
		expected: multisigModificationWithDeltaRead
	},
	{ name: 'cosignature', transaction: cosignature, expected: cosignatureRead },
	{ name: 'namespace registration (root)', transaction: namespaceRoot, expected: namespaceRootRead },
	{ name: 'namespace registration (sub)', transaction: namespaceSub, expected: namespaceSubRead },
	{ name: 'mosaic definition', transaction: mosaicDefinition, expected: mosaicDefinitionRead },
	{ name: 'mosaic definition with levy', transaction: mosaicDefinitionWithLevy, expected: mosaicDefinitionWithLevyRead },
	{ name: 'mosaic supply change', transaction: mosaicSupplyChange, expected: mosaicSupplyChangeRead },
	{ name: 'multisig importance transfer', transaction: multisigImportanceTransfer, expected: multisigImportanceTransferRead }
];
