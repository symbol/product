import { addressFromPublicKey } from './account';
import { getMosaicAmount, getMosaicProperty, mosaicIdFromRaw, mosaicListFromDTO } from './mosaic';
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

const transferMosaicsFromDTO = (transaction, networkCurrency, mosaicInfos) => {
	if (transaction.mosaics?.length)
		return mosaicListFromDTO(transaction.mosaics, mosaicInfos);

	const { mosaicId, name, divisibility } = networkCurrency;

	return [{
		id: mosaicId,
		name,
		amount: absoluteToRelativeAmount(transaction.amount || 0, divisibility),
		divisibility
	}];
};

const resolveTransferAmount = (transactionBody, nativeMosaicAmount, currentAccount) => {
	if (!currentAccount)
		return '0';

	const isIncoming = isIncomingTransaction(transactionBody, currentAccount);
	const isOutgoing = isOutgoingTransaction(transactionBody, currentAccount);

	if (nativeMosaicAmount === '0' || (isIncoming && isOutgoing) || (!isIncoming && !isOutgoing))
		return '0';

	if (isIncoming)
		return `${nativeMosaicAmount}`;

	return `${-nativeMosaicAmount}`;
};

// Reads the mosaic definition property array ([{ name, value }]) into the typed MosaicProperties shape.
const mapMosaicProperties = properties => ({
	divisibility: parseInt(getMosaicProperty(properties, MosaicPropertyName.DIVISIBILITY)),
	initialSupply: parseInt(getMosaicProperty(properties, MosaicPropertyName.INITIAL_SUPPLY)),
	supplyMutable: getMosaicProperty(properties, MosaicPropertyName.SUPPLY_MUTABLE) === 'true',
	transferable: getMosaicProperty(properties, MosaicPropertyName.TRANSFERABLE) !== 'false'
});

// NIS serializes an absent mosaic levy as an empty object; only a populated levy carries a recipient.
const levyFromDTO = levy => {
	if (!levy?.recipient)
		return null;

	return {
		type: levy.type,
		recipientAddress: levy.recipient,
		mosaicId: mosaicIdFromRaw(levy.mosaicId),
		fee: levy.fee
	};
};

/**
 * Converts a NEM transaction DTO to a transaction object.
 * @param {object} transactionDTO - The transaction DTO to convert.
 * @param {object} config - The configuration object.
 * @param {NetworkProperties} config.networkProperties - The network properties.
 * @param {PublicAccount} [config.currentAccount] - The current account, used to derive the directed amount.
 * @param {object.<string, object>} [config.mosaicInfos] - The mosaic id to info map.
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
			? absoluteToRelativeAmount(transaction.fee, networkProperties.networkCurrency.divisibility)
			: null,
		signerAddress,
		signerPublicKey
	};
};

const transferTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const { networkProperties, mosaicInfos = {}, currentAccount } = config;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const mosaics = transferMosaicsFromDTO(transaction, networkProperties.networkCurrency, mosaicInfos);
	const nativeMosaicAmount = getMosaicAmount(mosaics, networkProperties.networkCurrency.mosaicId);
	const transactionBody = {
		...baseTransaction,
		recipientAddress: transaction.recipient || null
	};

	if (transaction.message?.payload) {
		const nativeType = transaction.message.type;
		const { payload } = transaction.message;
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
		mosaics,
		amount: resolveTransferAmount(transactionBody, nativeMosaicAmount, currentAccount)
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
		mosaics: innerTransaction?.mosaics || [],
		amount: innerTransaction?.amount ?? '0',
		cosignatures,
		message: innerTransaction?.message || null
	};
};

const accountKeyLinkTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const { networkProperties } = config;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const remotePublicKey = transaction.remoteAccount;

	return {
		...baseTransaction,
		linkAction: transaction.mode,
		remotePublicKey,
		remoteAccountAddress: addressFromPublicKey(remotePublicKey, networkProperties.networkIdentifier)
	};
};

const multisigAccountModificationTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const modifications = (transaction.modifications || []).map(modification => ({
		modificationType: modification.modificationType,
		cosignatoryPublicKey: modification.cosignatoryAccount
	}));

	return {
		...baseTransaction,
		modifications,
		minApprovalDelta: transaction.minCosignatories?.relativeChange ?? 0
	};
};

const cosignatureTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	return {
		...baseTransaction,
		otherTransactionHash: transaction.otherHash?.data ?? null,
		multisigAccountAddress: transaction.otherAccount || null
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
		rentalFee: absoluteToRelativeAmount(transaction.rentalFee, networkProperties.networkCurrency.divisibility)
	};
};

const mosaicDefinitionTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const { networkProperties } = config;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const { mosaicDefinition } = transaction;

	return {
		...baseTransaction,
		mosaicDefinition: {
			id: mosaicIdFromRaw(mosaicDefinition.id),
			ownerPublicKey: mosaicDefinition.creator,
			description: mosaicDefinition.description,
			properties: mapMosaicProperties(mosaicDefinition.properties),
			levy: levyFromDTO(mosaicDefinition.levy)
		},
		rentalFeeSink: transaction.creationFeeSink,
		rentalFee: absoluteToRelativeAmount(transaction.creationFee, networkProperties.networkCurrency.divisibility)
	};
};

const mosaicSupplyChangeTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	return {
		...baseTransaction,
		mosaicId: mosaicIdFromRaw(transaction.mosaicId),
		action: transaction.supplyType,
		delta: transaction.delta
	};
};

/**
 * Extracts the unresolved (non-native) mosaic ids referenced by a list of transaction DTOs.
 * NEM does not alias addresses through namespaces, so only mosaic ids require resolution.
 * @param {object[]} transactionDTOs - The transaction DTOs.
 * @returns {{ mosaicIds: string[] }} The unresolved mosaic ids.
 */
export const getUnresolvedIdsFromTransactionDTOs = transactionDTOs => {
	const mosaicIds = new Set();

	const extractFromTransaction = transaction => {
		if (!transaction)
			return;

		transaction.mosaics?.forEach(mosaic => {
			const mosaicId = mosaicIdFromRaw(mosaic.mosaicId);

			if (mosaicId !== NETWORK_CURRENCY_ID)
				mosaicIds.add(mosaicId);
		});

		if (transaction.otherTrans)
			extractFromTransaction(transaction.otherTrans);
	};

	transactionDTOs.forEach(transactionDTO => extractFromTransaction(transactionDTO.transaction || transactionDTO));

	return {
		mosaicIds: [...mosaicIds]
	};
};
