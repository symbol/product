import { addressFromPublicKey } from './account';
import { createTransactionFee } from './fee';
import { getMosaicProperty, getTokenAmount, tokenIdFromRaw, tokenListFromDTO } from './token';
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
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Deadline} Deadline */
/** @typedef {import('../types/Transaction').Transaction} Transaction */

const formatTimestamp = nemTimestamp => {
	if (nemTimestamp === undefined || nemTimestamp === null)
		return null;

	return nemTimestampToDate(nemTimestamp);
};

// Builds the wallet deadline object from a DTO's NEM-second creation timestamp and expiry deadline.
const deadlineFromDTO = (timestamp, deadline) => {
	if (deadline === undefined || deadline === null)
		return null;

	return {
		timestamp: nemTimestampToDate(deadline),
		adjusted: { timestamp, deadline }
	};
};

const transferTokensFromDTO = (transaction, networkCurrency, tokenInfos) => {
	if (transaction.mosaics?.length)
		return tokenListFromDTO(transaction.mosaics, tokenInfos);

	const { id, name, divisibility } = networkCurrency;

	return [{
		id,
		name,
		amount: absoluteToRelativeAmount(transaction.amount || 0, divisibility),
		divisibility
	}];
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

const mapMosaicProperties = properties => ({
	divisibility: parseInt(getMosaicProperty(properties, MosaicPropertyName.DIVISIBILITY)),
	initialSupply: parseInt(getMosaicProperty(properties, MosaicPropertyName.INITIAL_SUPPLY)),
	isSupplyMutable: getMosaicProperty(properties, MosaicPropertyName.SUPPLY_MUTABLE) === 'true',
	isTransferable: getMosaicProperty(properties, MosaicPropertyName.TRANSFERABLE) !== 'false'
});

// NIS serializes an absent mosaic levy as an empty object; only a populated levy carries a recipient.
const levyFromDTO = levy => {
	if (!levy?.recipient)
		return {};

	return {
		levyType: MosaicTransferFeeTypeMessage[levy.type],
		levyRecipientAddress: levy.recipient,
		levyTokenId: tokenIdFromRaw(levy.mosaicId),
		levyFee: levy.fee
	};
};

/**
 * Converts a NEM transaction DTO to a transaction object.
 * @param {object} transactionDTO - The transaction DTO to convert.
 * @param {object} config - The configuration object.
 * @param {NetworkProperties} config.networkProperties - The network properties.
 * @param {PublicAccount} [config.currentAccount] - The current account, used to derive the directed amount.
 * @param {object.<string, object>} [config.tokenInfos] - The token id to info map.
 * @param {boolean} [config.isEmbedded] - A flag indicating if the transaction is embedded.
 * @returns {Transaction} The transaction object.
 */
export const transactionFromDTO = (transactionDTO, config) => {
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	switch (transactionDTO.transaction?.type ?? transactionDTO.type) {
	case TransactionType.TRANSFER:
		return transferTransactionFromDTO(transactionDTO, config);
	case TransactionType.ACCOUNT_KEY_LINK:
		return accountKeyLinkTransactionFromDTO(transactionDTO, config);
	case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
		return multisigAccountModificationTransactionFromDTO(transactionDTO, config);
	case TransactionType.MULTISIG_COSIGNATURE:
		return cosignatureTransactionFromDTO(transactionDTO, config);
	case TransactionType.MULTISIG:
		return multisigTransactionFromDTO(transactionDTO, config);
	case TransactionType.NAMESPACE_REGISTRATION:
		return namespaceRegistrationTransactionFromDTO(transactionDTO, config);
	case TransactionType.MOSAIC_DEFINITION:
		return mosaicDefinitionTransactionFromDTO(transactionDTO, config);
	case TransactionType.MOSAIC_SUPPLY_CHANGE:
		return mosaicSupplyChangeTransactionFromDTO(transactionDTO, config);
	}

	return baseTransaction;
};

const baseTransactionFromDTO = (transactionDTO, config) => {
	const { transaction, meta } = transactionDTO;
	const { networkProperties, isEmbedded } = config;
	const { type, signer } = transaction;
	const signerPublicKey = signer || null;
	const signerAddress = signerPublicKey ? addressFromPublicKey(signerPublicKey, networkProperties.networkIdentifier) : null;

	if (isEmbedded) {
		return {
			type,
			signerAddress,
			signerPublicKey
		};
	}

	return {
		type,
		timestamp: formatTimestamp(transaction.timeStamp),
		deadline: deadlineFromDTO(transaction.timeStamp, transaction.deadline),
		height: meta?.height ?? null,
		hash: meta?.hash?.data ?? null,
		fee: transaction.fee != null
			? createTransactionFee(
				networkProperties,
				absoluteToRelativeAmount(transaction.fee, networkProperties.networkCurrency.divisibility)
			)
			: null,
		signerAddress,
		signerPublicKey
	};
};

const transferTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const { networkProperties, tokenInfos = {}, currentAccount } = config;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const tokens = transferTokensFromDTO(transaction, networkProperties.networkCurrency, tokenInfos);
	const nativeTokenAmount = getTokenAmount(tokens, networkProperties.networkCurrency.id);
	const transactionBody = {
		...baseTransaction,
		recipientAddress: transaction.recipient || null
	};

	if (transaction.message?.payload) {
		const messageType = transaction.message.type;
		const { payload } = transaction.message;
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

const multisigTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const { networkProperties } = config;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	// The wrapped transaction is provided as otherTrans.
	const innerTransactionDTO = transaction.otherTrans
		? { transaction: transaction.otherTrans, meta: transactionDTO.meta || {} }
		: null;
	const innerTransaction = innerTransactionDTO
		? transactionFromDTO(innerTransactionDTO, { ...config, isEmbedded: true })
		: null;

	const cosignatures = transaction.signatures?.map(cosignature => ({
		signerPublicKey: cosignature.signer || null,
		signature: cosignature.signature,
		signerAddress: cosignature.signer ? addressFromPublicKey(cosignature.signer, networkProperties.networkIdentifier) : null
	})) || [];

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

const accountKeyLinkTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const { networkProperties } = config;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const linkedPublicKey = transaction.remoteAccount;

	return {
		...baseTransaction,
		linkAction: LinkActionMessage[transaction.mode],
		linkedPublicKey,
		linkedAccountAddress: addressFromPublicKey(linkedPublicKey, networkProperties.networkIdentifier)
	};
};

const multisigAccountModificationTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const { networkIdentifier } = config.networkProperties;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const modifications = transaction.modifications || [];
	const publicKeyAdditions = modifications
		.filter(modification => modification.modificationType === MultisigAccountModificationType.ADD_COSIGNATORY)
		.map(modification => modification.cosignatoryAccount);
	const publicKeyDeletions = modifications
		.filter(modification => modification.modificationType === MultisigAccountModificationType.DELETE_COSIGNATORY)
		.map(modification => modification.cosignatoryAccount);

	return {
		...baseTransaction,
		minApprovalDelta: transaction.minCosignatories?.relativeChange ?? 0,
		addressAdditions: publicKeyAdditions.map(publicKey => addressFromPublicKey(publicKey, networkIdentifier)),
		addressDeletions: publicKeyDeletions.map(publicKey => addressFromPublicKey(publicKey, networkIdentifier)),
		publicKeyAdditions,
		publicKeyDeletions
	};
};

const cosignatureTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	return {
		...baseTransaction,
		otherTransactionHash: transaction.otherHash?.data ?? null,
		multisigAddress: transaction.otherAccount || null
	};
};

const namespaceRegistrationTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const { networkProperties } = config;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const namespaceName = transaction.newPart;
	const parentName = transaction.parent ?? null;

	return {
		...baseTransaction,
		namespaceName,
		parentName,
		namespaceId: parentName ? `${parentName}.${namespaceName}` : namespaceName,
		rentalFeeSink: transaction.rentalFeeSink,
		rentalFee: createTransactionFee(
			networkProperties,
			absoluteToRelativeAmount(transaction.rentalFee, networkProperties.networkCurrency.divisibility)
		)
	};
};

const mosaicDefinitionTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const { networkProperties } = config;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const { mosaicDefinition } = transaction;

	return {
		...baseTransaction,
		tokenId: tokenIdFromRaw(mosaicDefinition.id),
		description: mosaicDefinition.description,
		...mapMosaicProperties(mosaicDefinition.properties),
		creatorPublicKey: mosaicDefinition.creator,
		...levyFromDTO(mosaicDefinition.levy),
		rentalFeeSink: transaction.creationFeeSink,
		rentalFee: createTransactionFee(
			networkProperties,
			absoluteToRelativeAmount(transaction.creationFee, networkProperties.networkCurrency.divisibility)
		)
	};
};

const mosaicSupplyChangeTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	return {
		...baseTransaction,
		tokenId: tokenIdFromRaw(transaction.mosaicId),
		action: MosaicSupplyChangeActionMessage[transaction.supplyType],
		delta: transaction.delta
	};
};

/**
 * Extracts the unresolved (non-native) mosaic ids referenced by a list of transaction DTOs.
 * NEM does not alias addresses through namespaces, so only mosaic ids require resolution.
 * @param {object[]} transactionDTOs - The transaction DTOs.
 * @returns {{ tokenIds: string[] }} The unresolved token ids.
 */
export const getUnresolvedIdsFromTransactionDTOs = transactionDTOs => {
	const tokenIds = new Set();

	const extractFromTransaction = transaction => {
		if (!transaction)
			return;

		transaction.mosaics?.forEach(mosaic => {
			const tokenId = tokenIdFromRaw(mosaic.mosaicId);

			if (tokenId !== NETWORK_CURRENCY_ID)
				tokenIds.add(tokenId);
		});

		if (transaction.otherTrans)
			extractFromTransaction(transaction.otherTrans);
	};

	transactionDTOs.forEach(transactionDTO => extractFromTransaction(transactionDTO.transaction || transactionDTO));

	return {
		tokenIds: [...tokenIds]
	};
};
