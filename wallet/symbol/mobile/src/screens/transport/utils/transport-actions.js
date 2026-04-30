import { ActionMethod } from '@/app/lib/transport';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/lib/transport').ShareAccountAddressUri} ShareAccountAddressUri */
/** @typedef {import('@/app/lib/transport').ShareTransferTransactionUri} ShareTransferTransactionUri */
/** @typedef {import('@/app/lib/transport').RequestSendTransactionUri} RequestSendTransactionUri */

/**
 * Union of the three supported transport URI action instances.
 * @typedef {ShareAccountAddressUri | ShareTransferTransactionUri | RequestSendTransactionUri} TransportUriObject
 */

/**
 * Data for a single action button displayed on the transport request screen.
 * @typedef {object} WalletActionItem
 * @property {string} icon - Icon identifier for the action button.
 * @property {string} title - Display title of the action.
 * @property {string} description - Human-readable description of what the action does.
 * @property {() => void} handlePress - Callback invoked when the action is selected.
 */

/**
 * Grouped action buttons (suggested and other) for a scanned transport URI.
 * @typedef {object} WalletActions
 * @property {WalletActionItem[]} suggested - Recommended actions for the scanned URI type.
 * @property {WalletActionItem[]} other - Additional available actions for the scanned URI type.
 */

/**
 * Context data passed to action condition predicates.
 * @typedef {object} WalletActionsContext
 * @property {ChainName} chainName - Chain name of the currently active wallet controller.
 */

/**
 * An action type with an optional predicate controlling its inclusion for a given URI.
 * @typedef {object} WalletActionCondition
 * @property {string} type - The wallet action type identifier.
 * @property {(uri: TransportUriObject, ctx: WalletActionsContext) => boolean} [when] - Optional predicate;
 * if omitted the action is always included.
 */

const WalletActionType = {
	ADD_CONTACT: 'add_contact',
	FILL_TRANSFER_FORM_ONLY_ADDRESS: 'fill_transfer_form_only_address',
	FILL_TRANSFER_FORM: 'fill_transfer_form'
};

const isMatchingChain = (uri, ctx) => ctx.chainName === uri.chainName;

const uriActionToWalletAction = {
	[ActionMethod.ACCOUNT_ADDRESS]: {
		suggested: [{ type: WalletActionType.ADD_CONTACT, when: isMatchingChain }],
		other: [{ type: WalletActionType.FILL_TRANSFER_FORM_ONLY_ADDRESS }]
	},
	[ActionMethod.TRANSFER_TRANSACTION]: {
		suggested: [{ type: WalletActionType.FILL_TRANSFER_FORM }],
		other: [{ type: WalletActionType.ADD_CONTACT, when: isMatchingChain }]
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
				address: transportUriObject.recipientAddress || transportUriObject.address
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
 * @param {TransportUriObject | null} transportUriObject - Parsed transport URI action instance.
 * @param {WalletActionsContext} [context] - Wallet state used to evaluate per-action conditions.
 * @returns {WalletActions} Categorized wallet actions with suggested and other lists.
 */
export const createWalletActions = (transportUriObject, context = {}) => {
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

	for (const { type, when } of actionConfig.suggested) {
		if (when && !when(transportUriObject, context)) 
			continue;

		const factory = actionFactoryMap[type];
		if (factory)
			suggested.push(factory(transportUriObject));
	}

	for (const { type, when } of actionConfig.other) {
		if (when && !when(transportUriObject, context)) 
			continue;

		const factory = actionFactoryMap[type];
		if (factory)
			other.push(factory(transportUriObject));
	}

	return { suggested, other };
};
