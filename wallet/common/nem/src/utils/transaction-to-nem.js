import { tokenIdToRaw } from './token';
import {
	LinkAction,
	LinkActionMessage,
	MosaicPropertyName,
	MosaicSupplyChangeAction,
	MosaicSupplyChangeActionMessage,
	MosaicTransferFeeType,
	MosaicTransferFeeTypeMessage,
	TransactionType
} from '../constants';
import { NemFacade, TransactionFactory } from 'symbol-sdk/nem';
import { relativeToAbsoluteAmount } from 'wallet-common-core';

/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Transaction} Transaction */

const linkActionMap = {
	[LinkActionMessage[LinkAction.Link]]: 'link',
	[LinkActionMessage[LinkAction.Unlink]]: 'unlink'
};

const mosaicSupplyChangeActionMap = {
	[MosaicSupplyChangeActionMessage[MosaicSupplyChangeAction.INCREASE]]: 'increase',
	[MosaicSupplyChangeActionMessage[MosaicSupplyChangeAction.DECREASE]]: 'decrease'
};

const mosaicLevyTypeMap = {
	[MosaicTransferFeeTypeMessage[MosaicTransferFeeType.ABSOLUTE]]: 'absolute',
	[MosaicTransferFeeTypeMessage[MosaicTransferFeeType.PERCENTILE]]: 'percentile'
};

const ADD_COSIGNATORY_MODIFICATION_TYPE = 'add_cosignatory';
const DELETE_COSIGNATORY_MODIFICATION_TYPE = 'delete_cosignatory';

const textEncoder = new TextEncoder();

const mapSignerPublicKey = signerPublicKey =>
	signerPublicKey || '0000000000000000000000000000000000000000000000000000000000000000';

const mapFee = fee => (fee?.token ? BigInt(relativeToAbsoluteAmount(fee.token.amount, fee.token.divisibility)) : 0n);

const mapDeadline = deadline => (deadline
	? { timestamp: deadline.adjusted.timestamp, deadline: deadline.adjusted.deadline }
	: { timestamp: 0, deadline: 0 });

const mapMessage = message => ({
	messageType: message.native.type,
	message: Buffer.from(message.payload, 'hex')
});

const mapMosaicId = id => {
	const { namespaceId, name } = tokenIdToRaw(id);

	return {
		namespaceId: { name: textEncoder.encode(namespaceId) },
		name: textEncoder.encode(name)
	};
};

const mapMosaic = token => ({
	mosaic: {
		mosaicId: mapMosaicId(token.id),
		amount: BigInt(relativeToAbsoluteAmount(token.amount, token.divisibility))
	}
});

const mapTransferAmountAndTokens = (tokens, networkCurrency) => {
	const nativeToken = tokens?.find(token => token.id === networkCurrency.id);
	const hasOnlyNativeToken = !tokens?.length || (nativeToken && tokens.length === 1);

	if (hasOnlyNativeToken) {
		return {
			amount: nativeToken ? BigInt(relativeToAbsoluteAmount(nativeToken.amount, networkCurrency.divisibility)) : 0n,
			mosaics: []
		};
	}

	// Mosaic transfers set the XEM amount field to a 1.0 multiplier applied to each mosaic quantity.
	return {
		amount: BigInt(relativeToAbsoluteAmount('1', networkCurrency.divisibility)),
		mosaics: tokens.map(mapMosaic)
	};
};

const mapModification = (modificationType, cosignatoryPublicKey) => ({
	modification: { modificationType, cosignatoryPublicKey }
});

const mapModifications = transaction => [
	...(transaction.publicKeyAdditions || []).map(publicKey => mapModification(ADD_COSIGNATORY_MODIFICATION_TYPE, publicKey)),
	...(transaction.publicKeyDeletions || []).map(publicKey => mapModification(DELETE_COSIGNATORY_MODIFICATION_TYPE, publicKey))
];

const mapMosaicProperties = transaction => {
	const propertyValues = [
		[MosaicPropertyName.DIVISIBILITY, transaction.divisibility],
		[MosaicPropertyName.INITIAL_SUPPLY, transaction.initialSupply],
		[MosaicPropertyName.SUPPLY_MUTABLE, transaction.isSupplyMutable],
		[MosaicPropertyName.TRANSFERABLE, transaction.isTransferable]
	];

	return propertyValues
		.filter(([, value]) => value !== undefined && value !== null)
		.map(([name, value]) => ({
			property: { name: textEncoder.encode(name), value: textEncoder.encode(String(value)) }
		}));
};

const mapMosaicLevy = transaction => ({
	transferFeeType: mosaicLevyTypeMap[transaction.levyType],
	recipientAddress: transaction.levyRecipientAddress,
	mosaicId: mapMosaicId(transaction.levyTokenId),
	fee: BigInt(transaction.levyFee)
});

const mapMosaicDefinition = transaction => {
	const definition = {
		ownerPublicKey: mapSignerPublicKey(transaction.creatorPublicKey || transaction.signerPublicKey),
		id: mapMosaicId(transaction.tokenId),
		description: textEncoder.encode(transaction.description || ''),
		properties: mapMosaicProperties(transaction)
	};

	if (transaction.levyRecipientAddress)
		definition.levy = mapMosaicLevy(transaction);

	return definition;
};

const createNemTransaction = (descriptor, networkIdentifier) => {
	const facade = new NemFacade(networkIdentifier);

	return facade.transactionFactory.create(descriptor);
};

/**
 * Converts a transaction to the NEM SDK format.
 * @param {Transaction} transaction - The transaction to convert.
 * @param {object} config - The configuration object.
 * @param {NetworkProperties} config.networkProperties - The network properties.
 * @param {boolean} [config.isEmbedded] - A flag indicating if the transaction is embedded.
 * @returns {object} The NEM SDK format transaction, or null for an unsupported type.
 */
export const transactionToNem = (transaction, config) => {
	switch (transaction.type) {
	case TransactionType.TRANSFER:
		return transferTransactionToNem(transaction, config);
	case TransactionType.ACCOUNT_KEY_LINK:
		return accountKeyLinkTransactionToNem(transaction, config);
	case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
		return multisigAccountModificationTransactionToNem(transaction, config);
	case TransactionType.MULTISIG_COSIGNATURE:
		return cosignatureTransactionToNem(transaction, config);
	case TransactionType.MULTISIG:
		return multisigTransactionToNem(transaction, config);
	case TransactionType.NAMESPACE_REGISTRATION:
		return namespaceRegistrationTransactionToNem(transaction, config);
	case TransactionType.MOSAIC_DEFINITION:
		return mosaicDefinitionTransactionToNem(transaction, config);
	case TransactionType.MOSAIC_SUPPLY_CHANGE:
		return mosaicSupplyChangeTransactionToNem(transaction, config);
	}

	return null;
};

const transferTransactionToNem = (transaction, config) => {
	const { networkIdentifier, networkCurrency } = config.networkProperties;
	const { amount, mosaics } = mapTransferAmountAndTokens(transaction.tokens, networkCurrency);
	const descriptor = {
		type: 'transfer_transaction_v2',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		...mapDeadline(transaction.deadline),
		recipientAddress: transaction.recipientAddress,
		amount
	};

	if (mosaics.length)
		descriptor.mosaics = mosaics;

	if (transaction.message?.payload)
		descriptor.message = mapMessage(transaction.message);

	return createNemTransaction(descriptor, networkIdentifier);
};

// NEM models the importance transfer (delegated harvesting) transaction as an account key link
// (NEM Technical Reference §4.2): linkAction toggles activation, linkedPublicKey is the remote account.
const accountKeyLinkTransactionToNem = (transaction, config) => {
	const { networkIdentifier } = config.networkProperties;
	const descriptor = {
		type: 'account_key_link_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		...mapDeadline(transaction.deadline),
		linkAction: linkActionMap[transaction.linkAction],
		remotePublicKey: transaction.linkedPublicKey
	};

	return createNemTransaction(descriptor, networkIdentifier);
};

const multisigAccountModificationTransactionToNem = (transaction, config) => {
	const { networkIdentifier } = config.networkProperties;
	const descriptor = {
		type: 'multisig_account_modification_transaction_v2',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		...mapDeadline(transaction.deadline),
		modifications: mapModifications(transaction),
		minApprovalDelta: transaction.minApprovalDelta ?? 0
	};

	return createNemTransaction(descriptor, networkIdentifier);
};

// A cosignature is itself a transaction in NEM (NEM Technical Reference §4.3.2): it signs the hash of
// the inner transaction held by a pending multisig transaction.
const cosignatureTransactionToNem = (transaction, config) => {
	const { networkIdentifier } = config.networkProperties;
	const descriptor = {
		type: 'cosignature_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		...mapDeadline(transaction.deadline),
		otherTransactionHash: transaction.otherTransactionHash,
		multisigAccountAddress: transaction.multisigAddress
	};

	return createNemTransaction(descriptor, networkIdentifier);
};

const multisigTransactionToNem = (transaction, config) => {
	const { networkIdentifier } = config.networkProperties;
	const nemInnerTransaction = transactionToNem(transaction.innerTransaction, config);
	const descriptor = {
		type: 'multisig_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		...mapDeadline(transaction.deadline),
		innerTransaction: TransactionFactory.toNonVerifiableTransaction(nemInnerTransaction)
	};

	return createNemTransaction(descriptor, networkIdentifier);
};

const namespaceRegistrationTransactionToNem = (transaction, config) => {
	const { networkIdentifier } = config.networkProperties;
	const isSubNamespace = !!transaction.parentName;
	const descriptor = {
		type: 'namespace_registration_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		...mapDeadline(transaction.deadline),
		rentalFeeSink: transaction.rentalFeeSink,
		rentalFee: mapFee(transaction.rentalFee),
		name: transaction.namespaceName
	};

	if (isSubNamespace)
		descriptor.parentName = transaction.parentName;

	return createNemTransaction(descriptor, networkIdentifier);
};

const mosaicDefinitionTransactionToNem = (transaction, config) => {
	const { networkIdentifier } = config.networkProperties;
	const descriptor = {
		type: 'mosaic_definition_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		...mapDeadline(transaction.deadline),
		rentalFeeSink: transaction.rentalFeeSink,
		rentalFee: mapFee(transaction.rentalFee),
		mosaicDefinition: mapMosaicDefinition(transaction)
	};

	return createNemTransaction(descriptor, networkIdentifier);
};

const mosaicSupplyChangeTransactionToNem = (transaction, config) => {
	const { networkIdentifier } = config.networkProperties;
	const descriptor = {
		type: 'mosaic_supply_change_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		...mapDeadline(transaction.deadline),
		mosaicId: mapMosaicId(transaction.tokenId),
		action: mosaicSupplyChangeActionMap[transaction.action],
		delta: BigInt(transaction.delta)
	};

	return createNemTransaction(descriptor, networkIdentifier);
};
