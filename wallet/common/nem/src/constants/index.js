import { Network } from 'symbol-sdk/nem';

// Derive epoch from the SDK — single source of truth for NEM network timing.
const nemEpochDate = new Date(Network.MAINNET.datetimeConverter.epoch);

/** NEM epoch start as a Unix timestamp in milliseconds. */
export const NEM_EPOCH = nemEpochDate.getTime();

/**
 * NEM1 block generation target time in seconds (NEM Technical Reference, §7.3).
 * Both mainnet and testnet share this protocol constant.
 */
export const BLOCK_GENERATION_TARGET_TIME = 60;

/** Deadline window, in hours, applied to a standard (single) transaction. */
export const SINGLE_TRANSACTION_DEADLINE_HOURS = 2;

/** Deadline window, in hours, applied to a multisig transaction. */
export const MULTISIG_TRANSACTION_DEADLINE_HOURS = 48;

/** NEM WebSocket endpoint path appended to the node URL. */
export const NEM_WS_PATH = '/w/messages/websocket';

// NEM native currency (XEM) constants.

/** Display name of the NEM native currency. */
export const NETWORK_CURRENCY_NAME = 'XEM';

/** Mosaic identifier string for the NEM native currency. */
export const NETWORK_CURRENCY_ID = 'nem.xem';

/** Decimal divisibility of the NEM native currency. */
export const NETWORK_CURRENCY_DIVISIBILITY = 6;

// Fee constants in absolute microXEM units (NEM Technical Reference, §7.6).

/**
 * Minimum transaction fee floor: 0.1 XEM.
 * NEM1 has no per-byte fee multiplier (unlike Symbol); this is a flat minimum applied to
 * every transaction.
 */
export const MIN_FEE = 100_000;

/** Fee charged per additional mosaic attached to a transfer: 0.05 XEM. */
export const FEE_PER_MOSAIC = 50_000;

/** Fee charged per 32 bytes of message payload: 0.05 XEM. */
export const FEE_PER_MESSAGE_CHUNK = 50_000;

/**
 * Base flat fee shared by several NEM transaction types: 0.15 XEM.
 * Applies to: importance transfer, multisig wrapper, multisig cosignature,
 * namespace provisioning (base component), mosaic definition, mosaic supply change.
 */
export const BASE_FEE = 150_000;

/** Fee for an aggregate modification transaction: 0.5 XEM. */
export const AGGREGATE_MODIFICATION_FEE = 500_000;

/** Rental fee for provisioning a root namespace: 100 XEM. */
export const ROOT_NAMESPACE_FEE = 100_000_000;

/** Rental fee for provisioning a sub-namespace: 10 XEM. */
export const SUB_NAMESPACE_FEE = 10_000_000;

// XEM transfer fee scaling constants (NEM Technical Reference, §4.1 / NEM API docs).

/** XEM amount per fee tier in transfer fee calculation: 10,000 XEM. */
export const XEM_TIER_AMOUNT = 10_000;

/** Fee added per completed XEM tier: 0.05 XEM. */
export const XEM_FEE_PER_TIER = 50_000;

/** Maximum XEM transfer fee component: 1.25 XEM (25 tiers). */
export const XEM_TRANSFER_FEE_MAX = 1_250_000;

export const TransactionGroup = {
	CONFIRMED: 'confirmed',
	UNCONFIRMED: 'unconfirmed',
	PARTIAL: 'partial',
	FAILED: 'failed'
};

export const TransactionAnnounceGroup = {
	DEFAULT: 'default',
	COSIGNATURE: 'cosignature'
};

/** NEM message type codes as defined in the NEM protocol and SDK models. */
export const MessageType = {
	PLAIN_TEXT: 1,
	ENCRYPTED_TEXT: 2
};

/**
 * Number of bytes the message-type marker (0x01/0x02) occupies at the start of an
 * encoded message payload (see encodePlainMessage / encryptMessage). This marker is a
 * wallet-internal framing byte and is excluded when sizing the message fee.
 */
export const MESSAGE_TYPE_PREFIX_LENGTH = 1;

/** NEM1 transaction type codes matching SDK TransactionType enum values. */
export const TransactionType = {
	RESERVED: 0,
	TRANSFER: 257,
	IMPORTANCE_TRANSFER: 2049,
	ACCOUNT_KEY_LINK: 2049,
	MULTISIG_ACCOUNT_MODIFICATION: 4097,
	MULTISIG_COSIGNATURE: 4098,
	MULTISIG: 4100,
	NAMESPACE_REGISTRATION: 8193,
	MOSAIC_DEFINITION: 16385,
	MOSAIC_SUPPLY_CHANGE: 16386
};

export const NetworkIdentifier = {
	MAIN_NET: 'mainnet',
	TEST_NET: 'testnet'
};

/** NEM network type byte values as defined in the SDK NetworkType enum. */
export const NetworkType = {
	MAIN_NET: 104,
	TEST_NET: 152
};

/** NEM account key link action codes. */
export const LinkAction = {
	LINK: 1,
	UNLINK: 2
};

/** NEM mosaic supply change action codes. */
export const MosaicSupplyChangeAction = {
	INCREASE: 1,
	DECREASE: 2
};

/** NEM multisig account modification type codes. */
export const MultisigAccountModificationType = {
	ADD_COSIGNATORY: 1,
	DELETE_COSIGNATORY: 2
};

/** NEM mosaic levy fee type codes. */
export const MosaicTransferFeeType = {
	ABSOLUTE: 1,
	PERCENTILE: 2
};

/** Property names used in NEM mosaic definition property arrays. */
export const MosaicPropertyName = {
	DIVISIBILITY: 'divisibility',
	INITIAL_SUPPLY: 'initialSupply',
	SUPPLY_MUTABLE: 'supplyMutable',
	TRANSFERABLE: 'transferable'
};

export const TransactionBundleType = {
	DEFAULT: 'default',
	MULTISIG_TRANSFER: 'multisig_transfer'
};
