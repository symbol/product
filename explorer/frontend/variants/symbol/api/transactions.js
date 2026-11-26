import { stubTransactions } from './fixtures';
import { stubPage } from './stub';
import { KEY_LINK_ACTION, SUPPLY_CHANGE_ACTION, TRANSACTION_TYPE } from '@/app/constants';
import { createApiUrl, createTryFetchInfoFunction, makeRequest } from '@/app/utils/server';

export const fetchTransactionPage = stubPage(stubTransactions);

/**
 * Fetches the Symbol transaction detail from Explorer REST.
 * @param {string} hash - requested transaction hash.
 * @returns {Promise<object|null>} mapped detail, or null for a client lookup error.
 */
export const fetchTransactionInfo = createTryFetchInfoFunction(async hash => {
	const transaction = await makeRequest(createApiUrl(`transaction/${hash}`));

	return transactionInfoFromDTO(transaction);
});

/**
 * Maps the detail envelope to the existing page model without recomputing REST values.
 * @param {object} data - transaction detail DTO.
 * @returns {object} transaction page model.
 */
const transactionInfoFromDTO = data => ({
	...data.info,
	hash: data.hash,
	isEmbedded: data.isEmbedded,
	aggregateHash: data.aggregateHash,
	embeddedIndex: data.embeddedIndex,
	type: data.type,
	group: data.group,
	version: data.version,
	signer: data.info.sender,
	detail: data.detail,
	aggregate: data.aggregate,
	hashLock: data.hashLock,
	body: data.graphic.transactions.map(graphicTransactionFromDTO),
	signatures: data.aggregate?.cosignatures ?? [],
	// REST does not provide account balance changes or a per-part fee breakdown.
	accountStateChange: null
});

/**
 * Maps only fields the shared TransactionGraphic can represent; retains Symbol detail.
 * @param {object} data - REST graphic item.
 * @returns {object} graphic item for the shared component.
 */
const graphicTransactionFromDTO = data => {
	const { type, sender, recipient, detail } = data;
	const item = { type, sender, recipient, detail };

	switch (type) {
	case TRANSACTION_TYPE.TRANSFER:
		return { ...item, mosaics: detail.mosaics, message: detail.message };
	case TRANSACTION_TYPE.MOSAIC_CREATION:
		return { ...item, mosaic: { id: detail.mosaicId, name: detail.mosaicId } };
	case TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE:
		return {
			...item,
			targetMosaic: { id: detail.mosaicId, name: detail.mosaicId },
			delta: detail.delta,
			supplyAction: detail.action === 'increase' ? SUPPLY_CHANGE_ACTION.INCREASE : SUPPLY_CHANGE_ACTION.DECREASE
		};
	case 'MOSAIC_ALIAS':
		return {
			...item,
			namespace: { id: detail.namespaceId, name: detail.namespaceName },
			targetMosaic: { id: detail.mosaicId, name: detail.mosaicId }
		};
	case 'ADDRESS_ALIAS':
	case TRANSACTION_TYPE.NAMESPACE_REGISTRATION:
		return { ...item, namespace: { id: detail.namespaceId, name: detail.namespaceName } };
	case TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION:
		return {
			...item,
			targetAccount: sender,
			cosignatoryAdditions: detail.addressAdditions,
			cosignatoryDeletions: detail.addressDeletions
		};
	case TRANSACTION_TYPE.ACCOUNT_KEY_LINK:
	case 'NODE_KEY_LINK':
	case 'VRF_KEY_LINK':
	case 'VOTING_KEY_LINK':
		return {
			...item,
			targetAccount: sender,
			keyLinkAction: detail.linkAction === 'link' ? KEY_LINK_ACTION.LINK : KEY_LINK_ACTION.UNLINK,
			linkedPublicKey: detail.linkedPublicKey,
			linkedAddress: detail.linkedAccountAddress
		};
	case 'HASH_LOCK':
	case 'SECRET_LOCK':
	case 'MOSAIC_SUPPLY_REVOCATION':
		return { ...item, mosaics: detail.mosaics };
	default:
		return item;
	}
};
