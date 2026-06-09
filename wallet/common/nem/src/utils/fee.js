import {
	MAX_MOSAIC_QUANTITY,
	MESSAGE_FEE_CHUNK_SIZE,
	NETWORK_CURRENCY_DIVISIBILITY,
	SMALL_BUSINESS_MOSAIC_MAX_SUPPLY,
	TransactionType,
	XEM_EQUIVALENT_NUMERATOR
} from '../constants';
import { absoluteToRelativeAmount, relativeToAbsoluteAmount } from 'wallet-common-core';

/** @typedef {import('../types/Mosaic').Mosaic} Mosaic */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Network').NemTransactionFees} NemTransactionFees */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */


const bigIntMax = (a, b) => (a > b ? a : b);
const bigIntMin = (a, b) => (a < b ? a : b);

/**
 * Asserts a fee input amount is non-negative.
 * @param {string|number} amount - The relative amount to validate.
 * @returns {void}
 * @private
 */
const assertNonNegativeAmount = amount => {
	if (String(amount).startsWith('-'))
		throw new Error(`Cannot calculate a fee for a negative amount: "${amount}"`);
};

/**
 * Creates a fee object for a transaction.
 * @param {object} networkProperties - The network properties.
 * @param {string} amount - The fee amount in relative units (string).
 * @returns {object} The fee object containing a token descriptor.
 */
export const createTransactionFee = (networkProperties, amount) => {
	return {
		token: {
			amount,
			divisibility: networkProperties.networkCurrency.divisibility,
			id: networkProperties.networkCurrency.mosaicId,
			name: networkProperties.networkCurrency.name
		}
	};
};

/**
 * Creates a fee tiers object for a NEM transaction.
 * NEM fees are deterministic, so all tiers (fast, medium, slow) are equal.
 * @param {object} networkProperties - The network properties.
 * @param {string} amount - The fee amount in relative units (string).
 * @returns {object} The fee tiers object with fast, medium, slow tiers.
 */
export const createTransactionFeeTiers = (networkProperties, amount) => {
	const tier = createTransactionFee(networkProperties, amount);
	
	return {
		fast: tier,
		medium: tier,
		slow: tier
	};
};

/**
 * Calculates the absolute fee in microXEM for a single non-native mosaic in a transfer.
 * Implements the NEM NIS API Documentation formula:
 *   xemEquivalent = floor((8,999,999,999 * q) / (s * 10^d))
 *   supplyRelatedAdjustment = floor(0.8 * ln(9,000,000,000,000,000 / (s * 10^d)))
 *   unweightedFee = max(1, floor(xemEquivalent / 10,000) - supplyRelatedAdjustment)
 *   fee = unweightedFee * perMosaicFee
 * For small business mosaics (divisibility 0, supply ≤ 10,000) the fee is a flat perMosaicFee.
 * Falls back to perMosaicFee when supply is not available on the mosaic object.
 * @param {Mosaic} mosaic - The mosaic being transferred (relative amount, divisibility, supply).
 * @param {number} [defaultDivisibility] - Divisibility to use when the mosaic lacks its own.
 * @param {NemTransactionFees} fees - The NEM fee schedule (absolute microXEM).
 * @returns {bigint} Absolute fee in microXEM for this single mosaic.
 * @private
 */
const calculateSingleMosaicFeeAbsolute = (mosaic, defaultDivisibility, fees) => {
	const divisibility = mosaic.divisibility ?? defaultDivisibility ?? NETWORK_CURRENCY_DIVISIBILITY;
	const { supply } = mosaic;
	const perMosaicFee = BigInt(fees.perMosaicFee);

	// Small business mosaic: divisibility 0, supply ≤ 10,000 → flat 0.05 XEM per transfer.
	if (divisibility === 0 && supply != null && supply <= SMALL_BUSINESS_MOSAIC_MAX_SUPPLY)
		return perMosaicFee;

	// Without supply info, fall back to the simplified flat fee.
	if (supply == null)
		return perMosaicFee;

	assertNonNegativeAmount(mosaic.amount);

	// Full mosaic fee formula. BigInt keeps the quantity products exact regardless of supply/divisibility.
	const absoluteQuantity = BigInt(relativeToAbsoluteAmount(mosaic.amount, divisibility));
	const totalMosaicQuantity = BigInt(supply) * (10n ** BigInt(divisibility));

	// Guard against malformed DTOs where supply was 0 — avoids BigInt division by zero.
	if (totalMosaicQuantity === 0n)
		return perMosaicFee;

	// XEM equivalent in whole XEM units: floor((8,999,999,999 * q) / (s * 10^d)) — exact BigInt division.
	const xemEquivalent = (XEM_EQUIVALENT_NUMERATOR * absoluteQuantity) / totalMosaicQuantity;

	// Supply-related adjustment: floor(0.8 * ln(maxMosaicQuantity / totalMosaicQuantity)). This term is an
	// intrinsically floating logarithm, so it is computed in Number and then folded back into BigInt.
	const supplyAdjustment = Math.floor(0.8 * Math.log(Number(MAX_MOSAIC_QUANTITY) / Number(totalMosaicQuantity)));
	const supplyRelatedAdjustment = BigInt(supplyAdjustment);

	// Unweighted fee in fee-units (1 unit = perMosaicFee = 0.05 XEM).
	const xemFeeUnits = xemEquivalent / BigInt(fees.xemTierAmount);
	const unweightedFee = bigIntMax(1n, xemFeeUnits - supplyRelatedAdjustment);

	return unweightedFee * perMosaicFee;
};

/**
 * Calculates the absolute fee in microXEM for a transfer transaction (NEM Technical Reference §4.1).
 * Fee = XEM-amount fee + per-mosaic fee + message fee. Each part is a multiple of the 0.05 XEM fee
 * unit; the XEM-amount part is floored at one unit when XEM is actually transferred.
 * @param {number|string} xemAmount - Native XEM amount transferred, in relative (whole-XEM) units.
 * @param {Mosaic[]} mosaics - Non-native mosaics attached to the transfer.
 * @param {number} divisibility - Default divisibility for mosaics lacking their own.
 * @param {string} [messagePayloadHex] - Encoded message payload hex (incl. 1-byte type marker), if any.
 * @param {NemTransactionFees} fees - The NEM fee schedule (absolute microXEM).
 * @returns {bigint} Absolute fee in microXEM.
 * @private
 */
const calculateTransferFeeAbsolute = (xemAmount, mosaics, divisibility, messagePayloadHex, fees) => {
	assertNonNegativeAmount(xemAmount);

	// Micro XEM are ignored per the NEM NIS API Documentation fee table ("All calculation are done with
	// rounded amounts of XEM"). Truncate to whole XEM via an integer-string conversion (divisibility 0)
	// so the native amount never passes through a float.
	const wholeXemAmount = BigInt(relativeToAbsoluteAmount(xemAmount, 0));

	// XEM-amount fee: 0.05 XEM per commenced 10,000 XEM transferred, capped at 1.25 XEM
	// (NEM Technical Reference §4.1; NEM NIS API Documentation fee table: 45,000 XEM → 0.20, 500,000 XEM → 1.25).
	// An actual XEM transfer is floored at one 0.05 XEM unit; a transfer that carries no native XEM
	// (mosaic-only or message-only) has no XEM-amount fee — only the mosaic and message fees apply.
	const xemTiers = wholeXemAmount > 0n
		? bigIntMax(1n, wholeXemAmount / BigInt(fees.xemTierAmount))
		: 0n;
	const xemFee = bigIntMin(xemTiers * BigInt(fees.xemFeePerTier), BigInt(fees.xemTransferFeeMax));

	const mosaicFee = (mosaics || []).reduce(
		(sum, mosaic) => sum + calculateSingleMosaicFeeAbsolute(mosaic, divisibility, fees),
		0n
	);

	// payload is the raw on-chain message bytes (no wallet-internal type marker), so its byte length is
	// the message length used for the fee.
	const messageLength = messagePayloadHex
		? messagePayloadHex.length / 2
		: 0;
	// Message fee per NEM Technical Reference §4.1: 0.05 XEM per commenced 32-byte chunk,
	// i.e. (floor(messageLength / 32) + 1) chunks.
	const messageFee = messageLength > 0
		? BigInt(Math.floor(messageLength / MESSAGE_FEE_CHUNK_SIZE) + 1) * BigInt(fees.perMessageChunkFee)
		: 0n;

	return xemFee + mosaicFee + messageFee;
};

/**
 * Calculates the absolute fee in microXEM for a transaction, dispatched by type.
 * Private — use calculateTransactionFee for the public (relative-amount) API.
 * @param {Transaction} transaction - The transaction to price.
 * @param {object} networkCurrency - The networkCurrency descriptor (mosaicId, divisibility).
 * @param {NemTransactionFees} fees - The NEM fee schedule (absolute microXEM).
 * @returns {bigint} Absolute fee in microXEM.
 * @private
 */
const calculateFeeAbsolute = (transaction, networkCurrency, fees) => {
	const { mosaicId: nativeMosaicId, divisibility } = networkCurrency;
	const effectiveDivisibility = divisibility ?? NETWORK_CURRENCY_DIVISIBILITY;
	const baseFee = BigInt(fees.baseFee);

	switch (transaction.type) {
	case TransactionType.TRANSFER: {
		const xemAmount = transaction.mosaics?.find(m => m.id === nativeMosaicId)?.amount || '0';
		// Exclude the native XEM mosaic from the per-mosaic fee; its cost is covered by the XEM-amount fee.
		const nonNativeMosaics = transaction.mosaics?.filter(m => m.id !== nativeMosaicId) || [];

		return calculateTransferFeeAbsolute(
			xemAmount,
			nonNativeMosaics,
			effectiveDivisibility,
			transaction.message?.payload,
			fees
		);
	}
	case TransactionType.MULTISIG: {
		// Multisig wrapper fee (0.15 XEM) added to the fee of the wrapped inner transaction
		// (NEM Technical Reference §4.3.3).
		const innerFee = transaction.innerTransaction
			? calculateFeeAbsolute(transaction.innerTransaction, networkCurrency, fees)
			: 0n;

		return baseFee + innerFee;
	}
	case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
		// Aggregate modification: flat 0.5 XEM regardless of the modifications (NEM Technical Reference §4.3.1).
		return BigInt(fees.aggregateModificationFee);
	case TransactionType.ACCOUNT_KEY_LINK:
		// Importance transfer / account key link: 0.15 XEM (NEM Technical Reference §4.2).
		return baseFee;
	case TransactionType.MULTISIG_COSIGNATURE:
		// Multisig signature transaction: 0.15 XEM (NEM Technical Reference §4.3.2).
		return baseFee;
	case TransactionType.NAMESPACE_REGISTRATION:
		// Provision namespace transaction fee: 0.15 XEM. The root (100 XEM) / sub (10 XEM) namespace
		// rental is paid separately to the rental fee sink (see networkProperties.rentalFees), so it
		// is not part of the transaction fee (NEM NIS API Documentation fee table).
		return baseFee;
	case TransactionType.MOSAIC_DEFINITION:
		// Mosaic definition creation transaction fee: 0.15 XEM. The 10 XEM creation fee is paid
		// separately to the creation fee sink (networkProperties.rentalFees.mosaicDefinitionFee),
		// so it is not part of the transaction fee (NEM NIS API Documentation).
		return baseFee;
	case TransactionType.MOSAIC_SUPPLY_CHANGE:
		// Mosaic supply change transaction: 0.15 XEM (NEM NIS API Documentation fee table).
		return baseFee;
	default:
		return baseFee;
	}
};

/**
 * Calculates the on-chain transaction fee for a given transaction based on its type and content.
 * Handles all NEM transaction types per the NEM Technical Reference §4 and the NEM NIS API
 * Documentation fee table. For MULTISIG, the fee includes the wrapper fee (0.15 XEM) plus the inner
 * transaction fee.
 * Namespace and mosaic-definition rental/creation fees are paid separately to a fee sink
 * (networkProperties.rentalFees) and are NOT included here.
 * The fee schedule is read from networkProperties.transactionFees (assembled by NetworkService).
 * @param {Transaction} transaction - The transaction object (fee field not required).
 * @param {NetworkProperties} networkProperties - The network properties (transactionFees, networkCurrency).
 * @returns {string} The relative fee amount (e.g. "0.15").
 */
export const calculateTransactionFee = (transaction, networkProperties) => {
	const { networkCurrency, transactionFees } = networkProperties;
	const effectiveDivisibility = networkCurrency.divisibility ?? NETWORK_CURRENCY_DIVISIBILITY;
	const absoluteFee = calculateFeeAbsolute(transaction, networkCurrency, transactionFees);
	
	return absoluteToRelativeAmount(absoluteFee.toString(), effectiveDivisibility);
};
