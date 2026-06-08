import { Network } from 'symbol-sdk/nem';
import { constants } from 'wallet-common-core';

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

/**
 * Deadline window, in hours, applied to a multisig transaction. NEM NIS rejects any deadline more than
 * 24 hours ahead (FAILURE_FUTURE_DEADLINE), so this is capped at the protocol maximum of 24h.
 */
export const MULTISIG_TRANSACTION_DEADLINE_HOURS = 24;

/** NEM NIS WebSocket port. NIS serves the REST API on 7890 and the SockJS/STOMP WebSocket on a separate 7778. */
export const NEM_WS_PORT = 7778;

/** NEM NIS SockJS base path. The Listener appends the per-connection `/{server}/{session}/websocket` segment. */
export const NEM_WS_PATH = '/w/messages';

// NEM native currency (XEM) constants.

/** Display name of the NEM native currency. */
export const NETWORK_CURRENCY_NAME = 'XEM';

/** Mosaic identifier string for the NEM native currency. */
export const NETWORK_CURRENCY_ID = 'nem.xem';

/** Decimal divisibility of the NEM native currency. */
export const NETWORK_CURRENCY_DIVISIBILITY = 6;

// On-chain transaction fee constants in absolute microXEM. NEM1 fees are deterministic
// protocol constants (not node-derived per-byte multipliers). Values follow the fee table in
// the NEM NIS API Documentation ("minimum fees for each transaction type") and the NEM Technical
// Reference §4. Every fee is a multiple of the 0.05 XEM fee unit.

/**
 * NEM fee unit and minimum transfer fee: 0.05 XEM (NEM Technical Reference §4.1).
 * Every NEM fee is a multiple of this unit and the XEM-amount transfer fee is floored at one
 * unit. Also used as the default fee for a transfer descriptor with no explicit fee.
 */
export const MIN_FEE = 50_000;

/**
 * Fee unit charged per non-native mosaic attached to a transfer: 0.05 XEM.
 * This is the per-mosaic weight (feeUnit) in the mosaic transfer fee formula and the flat fee
 * for a small business mosaic (NEM NIS API Documentation, transfer transaction fee table).
 */
export const FEE_PER_MOSAIC = 50_000;

/**
 * Fee per commenced 32 bytes of message payload: 0.05 XEM
 * (NEM Technical Reference §4.1: 0.05 XEM per commenced 32 message bytes).
 */
export const FEE_PER_MESSAGE_CHUNK = 50_000;

/** Message bytes priced per fee chunk: 32 (NEM Technical Reference §4.1). */
export const MESSAGE_FEE_CHUNK_SIZE = 32;

/**
 * Base flat transaction fee shared by several NEM transaction types: 0.15 XEM
 * (NEM NIS API Documentation fee table). Applies to: importance transfer / account key link
 * (NEM Technical Reference §4.2), multisig wrapper (§4.3.3), multisig cosignature (§4.3.2),
 * namespace provisioning, mosaic definition and mosaic supply change transactions.
 */
export const BASE_FEE = 150_000;

/**
 * Fee for an aggregate (multisig account) modification transaction: 0.5 XEM, flat regardless of
 * the number of modifications (NEM Technical Reference §4.3.1; NEM NIS API Documentation fee table).
 */
export const AGGREGATE_MODIFICATION_FEE = 500_000;

// XEM transfer fee scaling constants (NEM Technical Reference §4.1; NEM NIS API Documentation
// transfer transaction fee table). Worked examples: 45,000 XEM → 0.20 XEM, 500,000 XEM → 1.25 XEM.

/** XEM amount per fee tier in the transfer fee calculation: 10,000 XEM. */
export const XEM_TIER_AMOUNT = 10_000;

/** Fee added per completed 10,000 XEM tier: 0.05 XEM. */
export const XEM_FEE_PER_TIER = 50_000;

/** Maximum XEM-amount transfer fee component: 1.25 XEM (capped at 25 tiers of 0.05 XEM). */
export const XEM_TRANSFER_FEE_MAX = 1_250_000;

// Mosaic transfer fee formula constants (NEM NIS API Documentation, transfer transaction fee
// table, "Fees for transferring a mosaic to another account").

/** Maximum possible quantity of any mosaic, in smallest units: 9,000,000,000,000,000. */
export const MAX_MOSAIC_QUANTITY = 9_000_000_000_000_000n;

/** Numerator used to derive a mosaic's XEM-equivalent value in the transfer fee formula. */
export const XEM_EQUIVALENT_NUMERATOR = 8_999_999_999n;

/** Maximum supply of a small business mosaic (divisibility 0), which pays a flat per-mosaic fee: 10,000. */
export const SMALL_BUSINESS_MOSAIC_MAX_SUPPLY = 10_000;

// Rental / creation fees in absolute microXEM. These are NOT the transaction fee: they are paid
// to a dedicated rental or creation fee sink in a separate field of the transaction, in addition
// to the BASE_FEE transaction fee (NEM NIS API Documentation fee table and "Mosaic definition" §).

/** Rental fee for provisioning a root namespace: 100 XEM (NEM NIS API Documentation fee table). */
export const ROOT_NAMESPACE_FEE = 100_000_000;

/** Rental fee for provisioning a sub-namespace: 10 XEM (NEM NIS API Documentation fee table). */
export const SUB_NAMESPACE_FEE = 10_000_000;

/**
 * Creation fee for a mosaic definition: 10 XEM, paid to the creation fee sink to discourage
 * squatting (NEM NIS API Documentation, "The fee for creating a mosaic definition is 10 XEM").
 */
export const MOSAIC_DEFINITION_CREATION_FEE = 10_000_000;

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

/** Re-export of the common wallet-common-core message kinds for NEM consumers (the UI-facing type). */
export const { MessageType } = constants;

/**
 * NEM native (on-chain protocol) message-type codes. Stored on message.native.type and mapped to the
 * common MessageType (for message.type) via nativeToCommonMessageType.
 */
export const NativeMessageType = {
	PlainText: 1,
	EncryptedText: 2
};

/** Maps a NEM native message-type code to the common wallet-common-core MessageType. */
export const nativeToCommonMessageType = {
	[NativeMessageType.PlainText]: MessageType.PLAIN,
	[NativeMessageType.EncryptedText]: MessageType.ENCRYPTED
};

/**
 * NEM1 transaction type codes, matching the symbol-sdk NEM TransactionType enum values.
 * ACCOUNT_KEY_LINK (2049) is the SDK name for the NEM "importance transfer" transaction
 * (NEM Technical Reference §4.2).
 */
export const TransactionType = {
	RESERVED: 0,
	TRANSFER: 257,
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
	Link: 1,
	Unlink: 2
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
	MULTISIG_TRANSFER: 'multisig-transfer'
};
