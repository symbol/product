import { transactionToNem } from './transaction-to-nem';
import { NETWORK_CURRENCY_SUPPLY, TransactionType } from '../constants';
import { calculateTransactionFee as calculateNemTransactionFee } from 'symbol-sdk/nem';
import { absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

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
 * Derives the fully-qualified mosaic key (`namespace:name`) the symbol-sdk fee calculator uses to
 * look up mosaic information, matching how transactionToNem encodes the mosaic id.
 * @param {string} id - The mosaic id ('namespace.name').
 * @returns {string} The lookup key ('namespace:name').
 * @private
 */
const mosaicIdToLookupKey = id => {
	const [namespaceId, name] = id.split('.');

	return `${namespaceId}:${name}`;
};

/**
 * Builds the mosaic information lookup the symbol-sdk fee calculator needs to price a mosaic transfer.
 * Seeds the native currency (which has no on-chain mosaic definition) from its protocol supply. A mosaic
 * whose supply is unknown is left out.
 * @param {Transaction} transaction - The transaction being priced.
 * @param {object} networkCurrency - The network currency descriptor (mosaicId, divisibility).
 * @returns {function(object): {supply: bigint, divisibility: number}} The mosaic information lookup.
 * @private
 */
const createMosaicInformationLookup = (transaction, networkCurrency) => {
	const lookup = {
		[mosaicIdToLookupKey(networkCurrency.mosaicId)]: { 
			supply: NETWORK_CURRENCY_SUPPLY, 
			divisibility: networkCurrency.divisibility 
		}
	};

	(transaction.mosaics || []).forEach(mosaic => {
		if (mosaic.supply === undefined)
			return;

		lookup[mosaicIdToLookupKey(mosaic.id)] = {
			supply: BigInt(mosaic.supply),
			divisibility: mosaic.divisibility
		};
	});

	return mosaicId => lookup[`${mosaicId.namespaceId.name}:${mosaicId.name}`];
};

/**
 * Calculates the absolute fee in microXEM of a single transaction by delegating to the
 * symbol-sdk fee calculator. For a multisig transaction this is the wrapper fee only; the wrapped
 * inner transaction is priced separately.
 * @param {Transaction} transaction - The transaction to price.
 * @param {NetworkProperties} networkProperties - The network properties (networkCurrency, networkIdentifier).
 * @returns {bigint} The absolute fee in microXEM.
 * @private
 */
const calculateFeeAbsolute = (transaction, networkProperties) => {
	const nemTransaction = transactionToNem(transaction, { networkProperties });
	const mosaicInformationLookup = createMosaicInformationLookup(transaction, networkProperties.networkCurrency);

	return calculateNemTransactionFee(nemTransaction, mosaicInformationLookup);
};

/**
 * Calculates the fee of a single transaction, delegating to the symbol-sdk fee calculator. 
 * For a multisig transaction this returns the wrapper fee only.
 * @param {Transaction} transaction - The transaction to price.
 * @param {NetworkProperties} networkProperties - The network properties (networkCurrency, networkIdentifier).
 * @returns {string} The relative fee amount (e.g. "0.15").
 */
export const calculateTransactionFee = (transaction, networkProperties) => {
	const { divisibility } = networkProperties.networkCurrency;

	return absoluteToRelativeAmount(calculateFeeAbsolute(transaction, networkProperties).toString(), divisibility);
};

/**
 * Calculates the total on-chain fee a sender pays for a transaction, including the fee of any wrapped
 * inner transaction. For a multisig transfer this is the wrapper fee plus the inner transfer fee.
 * @param {Transaction} transaction - The transaction to price.
 * @param {NetworkProperties} networkProperties - The network properties (networkCurrency, networkIdentifier).
 * @returns {string} The relative total fee amount (e.g. "0.2").
 */
export const calculateTotalTransactionFee = (transaction, networkProperties) => {
	const { divisibility } = networkProperties.networkCurrency;

	let absoluteFee = calculateFeeAbsolute(transaction, networkProperties);

	if (transaction.type === TransactionType.MULTISIG && transaction.innerTransaction)
		absoluteFee += calculateFeeAbsolute(transaction.innerTransaction, networkProperties);

	return absoluteToRelativeAmount(absoluteFee.toString(), divisibility);
};
