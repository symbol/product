import { ActionMethod } from '@/app/lib/transport';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';

/** @typedef {import('@/app/lib/transport').ShareAccountAddressUri} ShareAccountAddressUri */
/** @typedef {import('@/app/lib/transport').ShareTransferTransactionUri} ShareTransferTransactionUri */
/** @typedef {import('@/app/lib/transport').RequestSendTransactionUri} RequestSendTransactionUri */

/**
 * @typedef {ShareAccountAddressUri | ShareTransferTransactionUri | RequestSendTransactionUri} TransportUriObject
 */

/**
 * @typedef {Object} WalletActionItem
 * @property {string} icon - Icon identifier for the action button
 * @property {string} title - Display title of the action
 * @property {string} description - Human-readable description of what the action does
 * @property {() => void} handlePress - Callback invoked when the action is selected
 */

/**
 * @typedef {Object} WalletActions
 * @property {WalletActionItem[]} suggested - Recommended actions for the scanned URI type
 * @property {WalletActionItem[]} other - Additional available actions for the scanned URI type
 */

const WalletActionType = {
	ADD_CONTACT: 'add_contact',
	FILL_TRANSFER_FORM_ONLY_ADDRESS: 'fill_transfer_form_only_address',
	FILL_TRANSFER_FORM: 'fill_transfer_form'
};

const uriActionToWalletAction = {
	[ActionMethod.ACCOUNT_ADDRESS]: {
		suggested: [WalletActionType.ADD_CONTACT],
		other: [WalletActionType.FILL_TRANSFER_FORM_ONLY_ADDRESS]
	},
	[ActionMethod.TRANSFER_TRANSACTION]: {
		suggested: [WalletActionType.FILL_TRANSFER_FORM],
		other: [WalletActionType.ADD_CONTACT]
	}
};

const createAddContactAction = transportUriObject => {
	return {
		icon: 'address-book',
		title: $t('s_transportRequest_action_addContact_title'),
		description: $t('s_transportRequest_action_addContact_description'),
		handlePress: () => Router.goToCreateContact({ 
			params: {
				name: transportUriObject.name,
				address: transportUriObject.address 
			} 
		})
	};
};

const createFillTransferFormAction = transportUriObject => {
	return {
		icon: 'send-plane',
		title: $t('s_transportRequest_action_fillTransferForm_title'),
		description: $t('s_transportRequest_action_fillTransferForm_description'),
		handlePress: () => Router.goToSend({
			params: {
				chainName: transportUriObject.chainName,
				recipientAddress: transportUriObject.recipientAddress || transportUriObject.address,
				tokenId: transportUriObject.tokenId,
				amount: transportUriObject.amount
			}
		})
	};
};

const createFillTransferFormOnlyAddressAction = transportUriObject => {
	const fillTransferFormAction = createFillTransferFormAction(transportUriObject);

	return {
		...fillTransferFormAction,
		description: $t('s_transportRequest_action_fillTransferFormOnlyAddress_description')
	};
};

/**
 * Creates categorized wallet actions based on the type of transport URI received.
 *
 * @param {TransportUriObject | null} transportUriObject - Parsed transport URI action instance
 * @returns {WalletActions} Categorized wallet actions with suggested and other lists
 */
export const createWalletActions = transportUriObject => {
	const actionFactoryMap = {
		[WalletActionType.ADD_CONTACT]: createAddContactAction,
		[WalletActionType.FILL_TRANSFER_FORM_ONLY_ADDRESS]: createFillTransferFormOnlyAddressAction,
		[WalletActionType.FILL_TRANSFER_FORM]: createFillTransferFormAction
	};
	const suggested = [];
	const other = [];

	if (!transportUriObject)
		return { suggested, other };

	const {method} = transportUriObject.constructor;
	const actionConfig = uriActionToWalletAction[method];

	if (!actionConfig)
		return { suggested, other };

	for (const actionType of actionConfig.suggested) {
		const factory = actionFactoryMap[actionType];
		if (factory)
			suggested.push(factory(transportUriObject));
	}

	for (const actionType of actionConfig.other) {
		const factory = actionFactoryMap[actionType];
		if (factory)
			other.push(factory(transportUriObject));
	}

	return { suggested, other };
};
