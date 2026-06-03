import { BASE_FEE, MESSAGE_TYPE_PREFIX_LENGTH, MIN_FEE, TransactionType } from '../constants';
import { NemFacade, TransactionFactory } from 'symbol-sdk/nem';
import { relativeToAbsoluteAmount } from 'wallet-common-core';

/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Transaction} Transaction */

const mapSignerPublicKey = signerPublicKey =>
	signerPublicKey || '0000000000000000000000000000000000000000000000000000000000000000';

const mapFee = (fee, fallback) => fee?.token?.amount
	? BigInt(relativeToAbsoluteAmount(fee.token.amount, fee.token.divisibility))
	: BigInt(fallback);

// The deadline window is baked in at compose time (see createDeadline), so mapping just reads the
// SDK-ready `adjusted` part onto the descriptor's creation `timestamp` and expiry `deadline`.
const mapDeadline = deadline => ({
	timestamp: deadline.adjusted.timestamp,
	deadline: deadline.adjusted.deadline
});

const mapMessage = message => ({
	messageType: message.type,
	// The wallet payload carries a leading type marker; the SDK expects only the on-chain message bytes.
	message: Buffer.from(message.payload, 'hex').subarray(MESSAGE_TYPE_PREFIX_LENGTH)
});

const mapMosaic = mosaic => {
	const [namespaceId, name] = mosaic.id.split('.');
	const encoder = new TextEncoder();

	// The SDK models a transfer mosaic as a SizePrefixedMosaic: a `mosaic` envelope around the id and amount.
	return {
		mosaic: {
			mosaicId: {
				namespaceId: { name: encoder.encode(namespaceId) },
				name: encoder.encode(name)
			},
			amount: BigInt(relativeToAbsoluteAmount(mosaic.amount, mosaic.divisibility))
		}
	};
};

const mapTransferAmountAndMosaics = (mosaics, networkCurrency) => {
	const nativeMosaic = mosaics?.find(mosaic => mosaic.id === networkCurrency.mosaicId);
	const hasOnlyNativeMosaic = !mosaics?.length || (nativeMosaic && mosaics.length === 1);

	if (hasOnlyNativeMosaic) {
		return {
			amount: nativeMosaic ? BigInt(relativeToAbsoluteAmount(nativeMosaic.amount, networkCurrency.divisibility)) : 0n,
			mosaics: []
		};
	}

	// Mosaic transfers set the XEM amount field to a 1.0 multiplier applied to each mosaic quantity.
	return {
		amount: BigInt(relativeToAbsoluteAmount('1', networkCurrency.divisibility)),
		mosaics: mosaics.map(mapMosaic)
	};
};

/**
 * Converts a transaction to the NEM SDK format.
 * @param {Transaction} transaction - The transaction to convert.
 * @param {object} config - The configuration object.
 * @param {NetworkProperties} config.networkProperties - The network properties.
 * @param {boolean} [config.isEmbedded] - A flag indicating if the transaction is embedded.
 * @returns {object} The NEM SDK format transaction.
 */
export const transactionToNem = (transaction, config) => {
	switch (transaction.type) {
	case TransactionType.TRANSFER:
		return transferTransactionToNem(transaction, config);
	case TransactionType.MULTISIG:
		return multisigTransactionToNem(transaction, config);
	}

	return null;
};

const transferTransactionToNem = (transaction, config) => {
	const { networkProperties } = config;
	const { networkIdentifier, networkCurrency } = networkProperties;
	const facade = new NemFacade(networkIdentifier);
	const { amount, mosaics } = mapTransferAmountAndMosaics(transaction.mosaics, networkCurrency);
	const descriptor = {
		type: 'transfer_transaction_v2',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee, MIN_FEE),
		...mapDeadline(transaction.deadline),
		recipientAddress: transaction.recipientAddress,
		amount
	};

	if (mosaics.length)
		descriptor.mosaics = mosaics;

	if (transaction.message?.payload)
		descriptor.message = mapMessage(transaction.message);

	return facade.transactionFactory.create(descriptor);
};

const multisigTransactionToNem = (transaction, config) => {
	const { networkProperties } = config;
	const { networkIdentifier } = networkProperties;
	const facade = new NemFacade(networkIdentifier);
	const nemInnerTransaction = transactionToNem(transaction.innerTransaction, config);
	const descriptor = {
		type: 'multisig_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee, BASE_FEE),
		...mapDeadline(transaction.deadline),
		innerTransaction: TransactionFactory.toNonVerifiableTransaction(nemInnerTransaction)
	};

	return facade.transactionFactory.create(descriptor);
};
