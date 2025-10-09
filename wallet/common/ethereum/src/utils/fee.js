import { ethers } from 'ethers';
import { absoluteToRelativeAmount, safeOperationWithRelativeAmounts } from 'wallet-common-core';

/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Network').TransactionFeeMultiplier} TransactionFeeMultiplier */
/** @typedef {import('../types/Network').TransactionFeeMultipliers} TransactionFeeMultipliers */
/** @typedef {import('../types/Transaction').TransactionFee} TransactionFee */
/** @typedef {import('../types/Transaction').TransactionFeeTires} TransactionFeeTires */
/** @typedef {import('../types/Token').TokenInfo} TokenInfo */

/**
 * Fixed fallback priority fee values (EIP-1559 tip) in wei.
 * Chosen as 1, 2, 3 gwei — a safe baseline for low network load.
 * These are used only if `eth_feeHistory` data is unavailable.
 */
const FALLBACK_PRIORITY_FEES_WEI = {
	slow: 1_000_000_000n,  // 1 gwei
	medium: 2_000_000_000n, // 2 gwei
	fast: 3_000_000_000n    // 3 gwei
};

/**
 * Base fee multipliers for EIP-1559 headroom.
 * Covers several blocks of potential baseFee increases.
 */
const BASE_FEE_MULTIPLIERS = {
	slow: 1.2,
	medium: 1.5,
	fast: 2.0
};

const parseHexToBigInt = hexString => {
	if (!hexString) 
		return 0n;

	try {
		return ethers.getBigInt(hexString);
	} catch {
		return 0n;
	}
};

const medianBigInt = values => {
	if (!values.length) 
		return 0n;

	const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
	const mid = Math.floor(sorted.length / 2);
    
	return sorted.length % 2
		? sorted[mid]
		: (sorted[mid - 1] + sorted[mid]) / 2n;
};

/**
 * Creates gas fee tiers (slow/medium/fast) using EIP-1559 rules.
 * @param {number} currencyDivisibility - e.g. 18 for ETH
 * @param {{ baseFeePerGas?: string[], reward?: string[][] }} feeHistory - from eth_feeHistory
 * @returns {TransactionFeeMultipliers} The transaction fee multipliers.
 */
export const createTransactionFeeMultipliers = (currencyDivisibility, feeHistory) => {
	const baseFees = Array.isArray(feeHistory?.baseFeePerGas) ? feeHistory.baseFeePerGas : [];
	const rewards = Array.isArray(feeHistory?.reward) ? feeHistory.reward : [];

	const nextBaseFee = baseFees.length
		? parseHexToBigInt(baseFees[baseFees.length - 1])
		: 0n;

	// Percentiles → [slow, medium, fast]
	const slowSamples = rewards.map(p => parseHexToBigInt(p?.[0]));
	const mediumSamples = rewards.map(p => parseHexToBigInt(p?.[1]));
	const fastSamples = rewards.map(p => parseHexToBigInt(p?.[2]));

	// Pick median or fallback
	const priorityFeesWei = {
		slow: slowSamples.length ? medianBigInt(slowSamples) : FALLBACK_PRIORITY_FEES_WEI.slow,
		medium: mediumSamples.length ? medianBigInt(mediumSamples) : FALLBACK_PRIORITY_FEES_WEI.medium,
		fast: fastSamples.length ? medianBigInt(fastSamples) : FALLBACK_PRIORITY_FEES_WEI.fast
	};

	// Ensure non-decreasing order
	if (priorityFeesWei.medium < priorityFeesWei.slow) 
		priorityFeesWei.medium = priorityFeesWei.slow;
    
	if (priorityFeesWei.fast < priorityFeesWei.medium) 
		priorityFeesWei.fast = priorityFeesWei.medium;
    

	// Helper to build fee tier
	const buildTier = (priorityFeeWei, multiplier) => {
		const maxFeeWei = BigInt(Math.floor(Number(nextBaseFee) * multiplier)) + priorityFeeWei;
		return {
			maxPriorityFeePerGas: absoluteToRelativeAmount(priorityFeeWei.toString(), currencyDivisibility),
			maxFeePerGas: absoluteToRelativeAmount(maxFeeWei.toString(), currencyDivisibility)
		};
	};

	return {
		slow: buildTier(priorityFeesWei.slow, BASE_FEE_MULTIPLIERS.slow),
		medium: buildTier(priorityFeesWei.medium, BASE_FEE_MULTIPLIERS.medium),
		fast: buildTier(priorityFeesWei.fast, BASE_FEE_MULTIPLIERS.fast)
	};
};


/**
 * Creates a fee object for transaction.
 * @param {TransactionFeeMultiplier} feeMultiplier - The fee multiplier object.
 * @param {string} gasLimit - The gas limit.
 * @param {TokenInfo} networkCurrency - The network currency token info.
 * @returns {TransactionFee} The fee object.
 */
export const createFee = (feeMultiplier, gasLimit, networkCurrency) => {
	const { maxFeePerGas, maxPriorityFeePerGas } = feeMultiplier;

	return {
		gasLimit,
		maxFeePerGas,
		maxPriorityFeePerGas,
		token: {
			amount: safeOperationWithRelativeAmounts(
				networkCurrency.divisibility,
				[maxFeePerGas],
				maxFeePerGas => maxFeePerGas * BigInt(gasLimit)
			),
			id: networkCurrency.id,
			name: networkCurrency.name,
			divisibility: networkCurrency.divisibility
		}
	};
};

/**
 * Creates fee tiers (slow/medium/fast) for transaction.
 * @param {NetworkProperties} networkProperties - The network properties.
 * @param {string} gasLimit - The gas limit.
 * @returns {TransactionFeeTires} The fee tiers.
 */
export const createTransactionFeeTiers = (networkProperties, gasLimit) => {
	const { transactionFees, networkCurrency } = networkProperties;

	return {
		slow: createFee(transactionFees.slow, gasLimit, networkCurrency),
		medium: createFee(transactionFees.medium, gasLimit, networkCurrency),
		fast: createFee(transactionFees.fast, gasLimit, networkCurrency)
	};
};
