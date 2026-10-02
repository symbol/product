import { addressFromPublicKey } from './account';
import { getTokenAmount, tokenListFromDTO } from './token';
import { decodePlainMessage, isIncomingTransaction, isOutgoingTransaction, nemTimestampToDate } from './transaction';
import {
	MessageType,
	MosaicPropertyName,
	NETWORK_CURRENCY_ID,
	NativeMessageType,
	TransactionType,
	nativeToCommonMessageType
} from '../constants';
import { absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Token').Token} Token */
/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Transaction} Transaction */

const ZERO_PUBLIC_KEY = '0000000000000000000000000000000000000000000000000000000000000000';

const mapAddress = address => Buffer.from(address.bytes).toString();

const mapBytesToString = bytes => Buffer.from(bytes).toString();

const mapTokenId = mosaicId => `${mapBytesToString(mosaicId.namespaceId.name)}.${mapBytesToString(mosaicId.name)}`;

const mapDeadline = transaction => {
	const timestamp = Number(transaction.timestamp.value);
	const deadline = Number(transaction.deadline.value);

	return {
		timestamp: nemTimestampToDate(deadline), // Local UI-ready deadline (ms since Unix epoch).
		adjusted: { timestamp, deadline }
	};
};

const resolveTransferAmount = (transactionBody, nativeTokenAmount, currentAccount) => {
	if (!currentAccount)
		return '0';

	const isIncoming = isIncomingTransaction(transactionBody, currentAccount);
	const isOutgoing = isOutgoingTransaction(transactionBody, currentAccount);

	if (nativeTokenAmount === '0' || (isIncoming && isOutgoing) || (!isIncoming && !isOutgoing))
		return '0';

	if (isIncoming)
		return `${nativeTokenAmount}`;

	return `${-nativeTokenAmount}`;
};

const mapTransferTokens = (transaction, networkCurrency, tokenInfos) => {
	if (transaction.mosaics?.length) {
		const mosaicsDTO = transaction.mosaics.map(({ mosaic }) => ({
			mosaicId: mapTokenId(mosaic.mosaicId),
			quantity: Number(mosaic.amount.value)
		}));

		return tokenListFromDTO(mosaicsDTO, tokenInfos);
	}

	const { id, name, divisibility } = networkCurrency;

	return [{
		id,
		name,
		amount: absoluteToRelativeAmount(Number(transaction.amount.value), divisibility),
		divisibility
	}];
};

const mapMosaicProperties = properties => {
	const propertyMap = {};
	properties.forEach(({ property }) => {
		propertyMap[mapBytesToString(property.name)] = mapBytesToString(property.value);
	});

	return {
		divisibility: parseInt(propertyMap[MosaicPropertyName.DIVISIBILITY] ?? '0'),
		initialSupply: parseInt(propertyMap[MosaicPropertyName.INITIAL_SUPPLY] ?? '0'),
		supplyMutable: propertyMap[MosaicPropertyName.SUPPLY_MUTABLE] === 'true',
		transferable: propertyMap[MosaicPropertyName.TRANSFERABLE] !== 'false'
	};
};

const mapMosaicLevy = levy => {
	if (!levy)
		return null;

	return {
		type: levy.transferFeeType.value,
		recipientAddress: mapAddress(levy.recipientAddress),
		mosaicId: mapTokenId(levy.mosaicId),
		fee: Number(levy.fee.value)
	};
};

/**
 * Converts a transaction from the NEM SDK format to the transaction object.
 * @param {object} transaction - The transaction object from the NEM SDK (verifiable or non-verifiable).
 * @param {object} config - The configuration object.
 * @param {NetworkProperties} config.networkProperties - The network properties.
 * @param {PublicAccount} [config.currentAccount] - The current account, used to derive the directed amount.
 * @param {object.<string, TokenInfo>} [config.tokenInfos] - The token id to info map.
 * @param {string} [config.fillSignerPublicKey] - The public key used when the transaction's signer is empty.
 * @param {boolean} [config.isEmbedded] - A flag indicating if the transaction is embedded (a multisig inner transaction).
 * @returns {Transaction} The transaction object.
 */
export const transactionFromNem = (transaction, config) => {
	const baseTransaction = baseTransactionFromNem(transaction, config);

	switch (transaction.type.value) {
	case TransactionType.TRANSFER:
		return transferTransactionFromNem(transaction, config);
	case TransactionType.ACCOUNT_KEY_LINK:
		return accountKeyLinkTransactionFromNem(transaction, config);
	case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
		return multisigAccountModificationTransactionFromNem(transaction, config);
	case TransactionType.MULTISIG_COSIGNATURE:
		return cosignatureTransactionFromNem(transaction, config);
	case TransactionType.MULTISIG:
		return multisigTransactionFromNem(transaction, config);
	case TransactionType.NAMESPACE_REGISTRATION:
		return namespaceRegistrationTransactionFromNem(transaction, config);
	case TransactionType.MOSAIC_DEFINITION:
		return mosaicDefinitionTransactionFromNem(transaction, config);
	case TransactionType.MOSAIC_SUPPLY_CHANGE:
		return mosaicSupplyChangeTransactionFromNem(transaction, config);
	}

	return baseTransaction;
};

const baseTransactionFromNem = (transaction, config) => {
	const { networkProperties } = config;
	const isSignerProvided = transaction.signerPublicKey?.toString() !== ZERO_PUBLIC_KEY;
	const signerPublicKey = isSignerProvided ? transaction.signerPublicKey.toString() : config.fillSignerPublicKey;
	const signerAddress = signerPublicKey ? addressFromPublicKey(signerPublicKey, networkProperties.networkIdentifier) : null;
	const type = transaction.type.value;

	// Embedded (multisig inner) transactions carry no fee or deadline of their own.
	if (config.isEmbedded) {
		return {
			type,
			signerAddress,
			signerPublicKey
		};
	}

	return {
		type,
		timestamp: nemTimestampToDate(Number(transaction.timestamp.value)),
		deadline: mapDeadline(transaction),
		fee: absoluteToRelativeAmount(Number(transaction.fee.value), networkProperties.networkCurrency.divisibility),
		signerAddress,
		signerPublicKey
	};
};

const transferTransactionFromNem = (transaction, config) => {
	const { networkProperties, tokenInfos = {}, currentAccount } = config;
	const baseTransaction = baseTransactionFromNem(transaction, config);
	const tokens = mapTransferTokens(transaction, networkProperties.networkCurrency, tokenInfos);
	const nativeTokenAmount = getTokenAmount(tokens, networkProperties.networkCurrency.id);
	const transactionBody = {
		...baseTransaction,
		recipientAddress: mapAddress(transaction.recipientAddress)
	};

	if (transaction.message?.message?.length) {
		const nativeType = transaction.message.messageType.value;
		const payload = Buffer.from(transaction.message.message).toString('hex');
		const text = nativeType === NativeMessageType.PlainText ? decodePlainMessage(payload) : null;

		transactionBody.message = {
			type: nativeToCommonMessageType[nativeType] ?? MessageType.RAW,
			text,
			payload,
			native: { type: nativeType }
		};
	}

	return {
		...transactionBody,
		tokens,
		amount: resolveTransferAmount(transactionBody, nativeTokenAmount, currentAccount)
	};
};

// NEM models the importance transfer (delegated harvesting) transaction as an account key link.
const accountKeyLinkTransactionFromNem = (transaction, config) => {
	const baseTransaction = baseTransactionFromNem(transaction, config);
	const remotePublicKey = transaction.remotePublicKey.toString();

	return {
		...baseTransaction,
		linkAction: transaction.linkAction.value,
		remotePublicKey,
		remoteAccountAddress: addressFromPublicKey(remotePublicKey, config.networkProperties.networkIdentifier)
	};
};

const multisigAccountModificationTransactionFromNem = (transaction, config) => {
	const baseTransaction = baseTransactionFromNem(transaction, config);
	const modifications = transaction.modifications.map(({ modification }) => ({
		modificationType: modification.modificationType.value,
		cosignatoryPublicKey: modification.cosignatoryPublicKey.toString()
	}));
	const result = {
		...baseTransaction,
		modifications,
		minApprovalDelta: transaction.minApprovalDelta ?? 0
	};

	return result;
};

const cosignatureTransactionFromNem = (transaction, config) => {
	const baseTransaction = baseTransactionFromNem(transaction, config);

	return {
		...baseTransaction,
		otherTransactionHash: transaction.otherTransactionHash.toString(),
		multisigAccountAddress: mapAddress(transaction.multisigAccountAddress)
	};
};

const multisigTransactionFromNem = (transaction, config) => {
	const baseTransaction = baseTransactionFromNem(transaction, config);
	const innerTransaction = transaction.innerTransaction
		? transactionFromNem(transaction.innerTransaction, { ...config, isEmbedded: true })
		: null;
	const cosignatures = transaction.cosignatures.map(({ cosignature }) => ({
		signerPublicKey: cosignature.signerPublicKey.toString(),
		signature: cosignature.signature.toString(),
		signerAddress: addressFromPublicKey(cosignature.signerPublicKey.toString(), config.networkProperties.networkIdentifier)
	}));

	return {
		...baseTransaction,
		innerTransaction,
		innerTransactions: innerTransaction ? [innerTransaction] : [],
		recipientAddress: innerTransaction?.recipientAddress || null,
		tokens: innerTransaction?.tokens || [],
		amount: innerTransaction?.amount ?? '0',
		cosignatures,
		message: innerTransaction?.message || null
	};
};

const namespaceRegistrationTransactionFromNem = (transaction, config) => {
	const baseTransaction = baseTransactionFromNem(transaction, config);
	const { divisibility } = config.networkProperties.networkCurrency;
	const parentName = transaction.parentName ? mapBytesToString(transaction.parentName) : null;
	const namespaceName = mapBytesToString(transaction.name);

	return {
		...baseTransaction,
		namespaceName,
		parentName,
		namespaceId: parentName ? `${parentName}.${namespaceName}` : namespaceName,
		rentalFeeSink: mapAddress(transaction.rentalFeeSink),
		rentalFee: absoluteToRelativeAmount(Number(transaction.rentalFee.value), divisibility)
	};
};

const mosaicDefinitionTransactionFromNem = (transaction, config) => {
	const baseTransaction = baseTransactionFromNem(transaction, config);
	const { divisibility } = config.networkProperties.networkCurrency;
	const { mosaicDefinition } = transaction;

	return {
		...baseTransaction,
		mosaicDefinition: {
			id: mapTokenId(mosaicDefinition.id),
			ownerPublicKey: mosaicDefinition.ownerPublicKey.toString(),
			description: mapBytesToString(mosaicDefinition.description),
			properties: mapMosaicProperties(mosaicDefinition.properties),
			levy: mapMosaicLevy(mosaicDefinition.levy)
		},
		rentalFeeSink: mapAddress(transaction.rentalFeeSink),
		rentalFee: absoluteToRelativeAmount(Number(transaction.rentalFee.value), divisibility)
	};
};

const mosaicSupplyChangeTransactionFromNem = (transaction, config) => {
	const baseTransaction = baseTransactionFromNem(transaction, config);

	return {
		...baseTransaction,
		tokenId: mapTokenId(transaction.mosaicId),
		action: transaction.action.value,
		delta: Number(transaction.delta.value)
	};
};

/**
 * Extracts the unresolved (non-native) mosaic ids referenced by a list of NEM SDK transactions.
 * NEM does not alias addresses through namespaces, so only mosaic ids require resolution.
 * @param {object[]} transactions - The NEM SDK transactions (from transactionToNem / deserialize).
 * @returns {{ tokenIds: string[] }} The unresolved token ids.
 */
export const getUnresolvedIdsFromNemTransactions = transactions => {
	const tokenIds = new Set();

	const extractFromTransaction = transaction => {
		if (!transaction)
			return;

		if (transaction.type.value === TransactionType.TRANSFER) {
			transaction.mosaics?.forEach(({ mosaic }) => {
				const tokenId = mapTokenId(mosaic.mosaicId);

				if (tokenId !== NETWORK_CURRENCY_ID)
					tokenIds.add(tokenId);
			});
		}

		if (transaction.type.value === TransactionType.MULTISIG)
			extractFromTransaction(transaction.innerTransaction);
	};

	transactions.forEach(extractFromTransaction);

	return {
		tokenIds: [...tokenIds]
	};
};
