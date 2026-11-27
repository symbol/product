import {
	LinkAction,
	MosaicSupplyChangeAction,
	MosaicTransferFeeType,
	MultisigAccountModificationType,
	TransactionType
} from '../constants';
import { NemFacade, TransactionFactory } from 'symbol-sdk/nem';

const linkActionMap = {
	[LinkAction.Link]: 'link',
	[LinkAction.Unlink]: 'unlink'
};

const mosaicSupplyChangeActionMap = {
	[MosaicSupplyChangeAction.INCREASE]: 'increase',
	[MosaicSupplyChangeAction.DECREASE]: 'decrease'
};

const mosaicLevyTypeMap = {
	[MosaicTransferFeeType.ABSOLUTE]: 'absolute',
	[MosaicTransferFeeType.PERCENTILE]: 'percentile'
};

const modificationTypeMap = {
	[MultisigAccountModificationType.ADD_COSIGNATORY]: 'add_cosignatory',
	[MultisigAccountModificationType.DELETE_COSIGNATORY]: 'delete_cosignatory'
};

const textEncoder = new TextEncoder();

// NIS packs the network into the high byte of the DTO version; the low byte is the transaction version.
const getTransactionVersion = transaction => transaction.version & 0xFF;

const mapMosaicId = ({ namespaceId, name }) => ({
	namespaceId: { name: textEncoder.encode(namespaceId) },
	name: textEncoder.encode(name)
});

/**
 * Converts a transaction DTO to the NEM SDK format, keeping the transaction version returned by the node.
 * @param {object} transactionDTO - The transaction DTO to convert.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {object|null} The NEM SDK format transaction, or null for an unsupported type.
 */
export const transactionDTOToNem = (transactionDTO, networkIdentifier) => {
	const { transaction } = transactionDTO;
	const descriptor = createDescriptor(transaction, networkIdentifier);

	if (!descriptor)
		return null;

	const facade = new NemFacade(networkIdentifier);

	return facade.transactionFactory.create({
		...descriptor,
		signerPublicKey: transaction.signer,
		fee: BigInt(transaction.fee),
		timestamp: transaction.timeStamp,
		deadline: transaction.deadline
	});
};

const createDescriptor = (transaction, networkIdentifier) => {
	switch (transaction.type) {
	case TransactionType.TRANSFER:
		return createTransferDescriptor(transaction);
	case TransactionType.ACCOUNT_KEY_LINK:
		return createAccountKeyLinkDescriptor(transaction);
	case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
		return createMultisigAccountModificationDescriptor(transaction);
	case TransactionType.MULTISIG_COSIGNATURE:
		return createCosignatureDescriptor(transaction);
	case TransactionType.MULTISIG:
		return createMultisigDescriptor(transaction, networkIdentifier);
	case TransactionType.NAMESPACE_REGISTRATION:
		return createNamespaceRegistrationDescriptor(transaction);
	case TransactionType.MOSAIC_DEFINITION:
		return createMosaicDefinitionDescriptor(transaction);
	case TransactionType.MOSAIC_SUPPLY_CHANGE:
		return createMosaicSupplyChangeDescriptor(transaction);
	}

	return null;
};

const createTransferDescriptor = transaction => {
	const descriptor = {
		type: `transfer_transaction_v${getTransactionVersion(transaction)}`,
		recipientAddress: transaction.recipient,
		amount: BigInt(transaction.amount)
	};

	if (transaction.message?.payload) {
		descriptor.message = {
			messageType: transaction.message.type,
			message: Buffer.from(transaction.message.payload, 'hex')
		};
	}

	if (transaction.mosaics?.length) {
		descriptor.mosaics = transaction.mosaics.map(mosaic => ({
			mosaic: { mosaicId: mapMosaicId(mosaic.mosaicId), amount: BigInt(mosaic.quantity) }
		}));
	}

	return descriptor;
};

const createAccountKeyLinkDescriptor = transaction => ({
	type: 'account_key_link_transaction_v1',
	linkAction: linkActionMap[transaction.mode],
	remotePublicKey: transaction.remoteAccount
});

const createMultisigAccountModificationDescriptor = transaction => {
	const descriptor = {
		type: `multisig_account_modification_transaction_v${getTransactionVersion(transaction)}`,
		modifications: transaction.modifications.map(modification => ({
			modification: {
				modificationType: modificationTypeMap[modification.modificationType],
				cosignatoryPublicKey: modification.cosignatoryAccount
			}
		}))
	};

	if (transaction.minCosignatories)
		descriptor.minApprovalDelta = transaction.minCosignatories.relativeChange;

	return descriptor;
};

const createCosignatureDescriptor = transaction => ({
	type: 'cosignature_v1',
	otherTransactionHash: transaction.otherHash.data,
	multisigAccountAddress: transaction.otherAccount
});

const createMultisigDescriptor = (transaction, networkIdentifier) => {
	const nemInnerTransaction = transactionDTOToNem({ transaction: transaction.otherTrans }, networkIdentifier);

	return {
		type: 'multisig_transaction_v1',
		innerTransaction: TransactionFactory.toNonVerifiableTransaction(nemInnerTransaction)
	};
};

const createNamespaceRegistrationDescriptor = transaction => {
	const descriptor = {
		type: 'namespace_registration_transaction_v1',
		rentalFeeSink: transaction.rentalFeeSink,
		rentalFee: BigInt(transaction.rentalFee),
		name: transaction.newPart
	};

	if (transaction.parent)
		descriptor.parentName = transaction.parent;

	return descriptor;
};

const createMosaicDefinitionDescriptor = transaction => {
	const { creator, id, description, properties, levy } = transaction.mosaicDefinition;
	const mosaicDefinition = {
		ownerPublicKey: creator,
		id: mapMosaicId(id),
		description: textEncoder.encode(description),
		properties: properties.map(({ name, value }) => ({
			property: { name: textEncoder.encode(name), value: textEncoder.encode(value) }
		}))
	};

	if (levy?.recipient) {
		mosaicDefinition.levy = {
			transferFeeType: mosaicLevyTypeMap[levy.type],
			recipientAddress: levy.recipient,
			mosaicId: mapMosaicId(levy.mosaicId),
			fee: BigInt(levy.fee)
		};
	}

	return {
		type: 'mosaic_definition_transaction_v1',
		rentalFeeSink: transaction.creationFeeSink,
		rentalFee: BigInt(transaction.creationFee),
		mosaicDefinition
	};
};

const createMosaicSupplyChangeDescriptor = transaction => ({
	type: 'mosaic_supply_change_transaction_v1',
	mosaicId: mapMosaicId(transaction.mosaicId),
	action: mosaicSupplyChangeActionMap[transaction.supplyType],
	delta: BigInt(transaction.delta)
});
