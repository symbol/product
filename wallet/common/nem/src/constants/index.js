import { Network } from 'symbol-sdk/nem';
import { constants } from 'wallet-common-core';

// Derive epoch from the SDK — single source of truth for NEM network timing.
const nemEpochDate = new Date(Network.MAINNET.datetimeConverter.epoch);

/** NEM epoch start as a Unix timestamp in milliseconds. */
export const NEM_EPOCH = nemEpochDate.getTime();

/**
 * NEM block generation target time in seconds (NEM Technical Reference, §7.3).
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

/** NEM XEM total supply (8,999,999,999 XEM). */
export const NETWORK_CURRENCY_SUPPLY = 8_999_999_999n;

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
 * NEM transaction type codes, matching the symbol-sdk NEM TransactionType enum values.
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
