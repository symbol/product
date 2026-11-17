import { addressFromPublicKey } from './account';
import { createTransactionFee } from './fee';
import { getTokenAmount, tokenListFromDTO } from './token';
import { decodePlainMessage, getMessageKind, isIncomingTransaction, isOutgoingTransaction, nemTimestampToDate } from './transaction';
import {
	LinkActionMessage,
	MessageType,
	MosaicPropertyName,
	MosaicSupplyChangeActionMessage,
	MosaicTransferFeeTypeMessage,
	MultisigAccountModificationType,
	NETWORK_CURRENCY_ID,
	TransactionType
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
		isSupplyMutable: propertyMap[MosaicPropertyName.SUPPLY_MUTABLE] === 'true',
		isTransferable: propertyMap[MosaicPropertyName.TRANSFERABLE] !== 'false'
	};
};

const mapMosaicLevy = levy => {
	if (!levy)
		return {};

	return {
		levyType: MosaicTransferFeeTypeMessage[levy.transferFeeType.value],
		levyRecipientAddress: mapAddress(levy.recipientAddress),
		levyTokenId: mapTokenId(levy.mosaicId),
		levyFee: Number(levy.fee.value)
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
		fee: createTransactionFee(
			networkProperties,
			absoluteToRelativeAmount(Number(transaction.fee.value), networkProperties.networkCurrency.divisibility)
		),
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
		const messageType = transaction.message.messageType.value;
		const payload = Buffer.from(transaction.message.message).toString('hex');
		const text = messageType === MessageType.PlainText ? decodePlainMessage(payload) : null;

		transactionBody.message = {
			type: messageType,
			kind: getMessageKind(messageType),
			text,
			payload
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
	const linkedPublicKey = transaction.remotePublicKey.toString();

	return {
		...baseTransaction,
		linkAction: LinkActionMessage[transaction.linkAction.value],
		linkedPublicKey,
		linkedAccountAddress: addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier)
	};
};

const multisigAccountModificationTransactionFromNem = (transaction, config) => {
	const { networkIdentifier } = config.networkProperties;
	const baseTransaction = baseTransactionFromNem(transaction, config);
	const { modifications } = transaction;
	const publicKeyAdditions = modifications
		.filter(({ modification }) => modification.modificationType.value === MultisigAccountModificationType.ADD_COSIGNATORY)
		.map(({ modification }) => modification.cosignatoryPublicKey.toString());
	const publicKeyDeletions = modifications
		.filter(({ modification }) => modification.modificationType.value === MultisigAccountModificationType.DELETE_COSIGNATORY)
		.map(({ modification }) => modification.cosignatoryPublicKey.toString());

	return {
		...baseTransaction,
		minApprovalDelta: transaction.minApprovalDelta ?? 0,
		addressAdditions: publicKeyAdditions.map(publicKey => addressFromPublicKey(publicKey, networkIdentifier)),
		addressDeletions: publicKeyDeletions.map(publicKey => addressFromPublicKey(publicKey, networkIdentifier)),
		publicKeyAdditions,
		publicKeyDeletions
	};
};

const cosignatureTransactionFromNem = (transaction, config) => {
	const baseTransaction = baseTransactionFromNem(transaction, config);

	return {
		...baseTransaction,
		otherTransactionHash: transaction.otherTransactionHash.toString(),
		multisigAddress: mapAddress(transaction.multisigAccountAddress)
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
		rentalFee: createTransactionFee(
			config.networkProperties,
			absoluteToRelativeAmount(Number(transaction.rentalFee.value), divisibility)
		)
	};
};

const mosaicDefinitionTransactionFromNem = (transaction, config) => {
	const baseTransaction = baseTransactionFromNem(transaction, config);
	const { divisibility } = config.networkProperties.networkCurrency;
	const { mosaicDefinition } = transaction;

	return {
		...baseTransaction,
		tokenId: mapTokenId(mosaicDefinition.id),
		description: mapBytesToString(mosaicDefinition.description),
		...mapMosaicProperties(mosaicDefinition.properties),
		creatorPublicKey: mosaicDefinition.ownerPublicKey.toString(),
		...mapMosaicLevy(mosaicDefinition.levy),
		rentalFeeSink: mapAddress(transaction.rentalFeeSink),
		rentalFee: createTransactionFee(
			config.networkProperties,
			absoluteToRelativeAmount(Number(transaction.rentalFee.value), divisibility)
		)
	};
};

const mosaicSupplyChangeTransactionFromNem = (transaction, config) => {
	const baseTransaction = baseTransactionFromNem(transaction, config);

	return {
		...baseTransaction,
		tokenId: mapTokenId(transaction.mosaicId),
		action: MosaicSupplyChangeActionMessage[transaction.action.value],
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
