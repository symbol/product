import { mosaicIdToRaw } from './mosaic';
import {
	LinkAction,
	MosaicPropertyName,
	MosaicSupplyChangeAction,
	MosaicTransferFeeType,
	MultisigAccountModificationType,
	TransactionType
} from '../constants';
import { NemFacade, TransactionFactory } from 'symbol-sdk/nem';
import { relativeToAbsoluteAmount } from 'wallet-common-core';

/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').MosaicDefinition} MosaicDefinition */
/** @typedef {import('../types/Transaction').Transaction} Transaction */

const linkActionMap = {
	[LinkAction.Link]: 'link',
	[LinkAction.Unlink]: 'unlink'
};

const mosaicSupplyChangeActionMap = {
	[MosaicSupplyChangeAction.INCREASE]: 'increase',
	[MosaicSupplyChangeAction.DECREASE]: 'decrease'
};

const multisigModificationTypeMap = {
	[MultisigAccountModificationType.ADD_COSIGNATORY]: 'add_cosignatory',
	[MultisigAccountModificationType.DELETE_COSIGNATORY]: 'delete_cosignatory'
};

const mosaicLevyTypeMap = {
	[MosaicTransferFeeType.ABSOLUTE]: 'absolute',
	[MosaicTransferFeeType.PERCENTILE]: 'percentile'
};

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
	const { namespaceId, name } = mosaicIdToRaw(id);

	return {
		namespaceId: { name: textEncoder.encode(namespaceId) },
		name: textEncoder.encode(name)
	};
};

const mapMosaic = mosaic => ({
	mosaic: {
		mosaicId: mapMosaicId(mosaic.id),
		amount: BigInt(relativeToAbsoluteAmount(mosaic.amount, mosaic.divisibility))
	}
});

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

const mapModifications = modifications => (modifications || []).map(modification => ({
	modification: {
		modificationType: multisigModificationTypeMap[modification.modificationType],
		cosignatoryPublicKey: modification.cosignatoryPublicKey
	}
}));

const mapMosaicProperties = properties => {
	if (!properties)
		return [];

	const propertyValues = [
		[MosaicPropertyName.DIVISIBILITY, properties.divisibility],
		[MosaicPropertyName.INITIAL_SUPPLY, properties.initialSupply],
		[MosaicPropertyName.SUPPLY_MUTABLE, properties.supplyMutable],
		[MosaicPropertyName.TRANSFERABLE, properties.transferable]
	];

	return propertyValues
		.filter(([, value]) => value !== undefined && value !== null)
		.map(([name, value]) => ({
			property: { name: textEncoder.encode(name), value: textEncoder.encode(String(value)) }
		}));
};

const mapMosaicLevy = levy => ({
	transferFeeType: mosaicLevyTypeMap[levy.type],
	recipientAddress: levy.recipientAddress,
	mosaicId: mapMosaicId(levy.mosaicId),
	fee: BigInt(levy.fee)
});

const mapMosaicDefinition = (mosaicDefinition, signerPublicKey) => {
	const definition = {
		ownerPublicKey: mapSignerPublicKey(mosaicDefinition.ownerPublicKey || signerPublicKey),
		id: mapMosaicId(mosaicDefinition.id),
		description: textEncoder.encode(mosaicDefinition.description || ''),
		properties: mapMosaicProperties(mosaicDefinition.properties)
	};

	if (mosaicDefinition.levy)
		definition.levy = mapMosaicLevy(mosaicDefinition.levy);

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
	const { amount, mosaics } = mapTransferAmountAndMosaics(transaction.mosaics, networkCurrency);
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
// (NEM Technical Reference §4.2): linkAction toggles activation, remotePublicKey is the remote account.
const accountKeyLinkTransactionToNem = (transaction, config) => {
	const { networkIdentifier } = config.networkProperties;
	const descriptor = {
		type: 'account_key_link_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		...mapDeadline(transaction.deadline),
		linkAction: linkActionMap[transaction.linkAction],
		remotePublicKey: transaction.remotePublicKey
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
		modifications: mapModifications(transaction.modifications),
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
		multisigAccountAddress: transaction.multisigAccountAddress
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
		mosaicDefinition: mapMosaicDefinition(transaction.mosaicDefinition, transaction.signerPublicKey)
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
		mosaicId: mapMosaicId(transaction.mosaicId),
		action: mosaicSupplyChangeActionMap[transaction.action],
		delta: BigInt(transaction.delta)
	};

	return createNemTransaction(descriptor, networkIdentifier);
};
