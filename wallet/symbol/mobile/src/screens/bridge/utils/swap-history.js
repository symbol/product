import { createSwapStatusDisplayData } from './swap-status';
import { $t } from '@/app/localization';
import { BRIDGE_HISTORY_PAGE_SIZE } from '@/app/screens/bridge/constants';
import { BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { createTokenDisplayData, formatDate } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeError} BridgeError */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequest} BridgeRequest */
/** @typedef {import('@/app/screens/bridge/types/ViewModel').SwapHistoryItem} SwapHistoryItem */
/** @typedef {import('@/app/screens/bridge/types/ViewModel').SwapHistoryViewModel} SwapHistoryViewModel */
/** @typedef {import('@/app/screens/bridge/types/ViewModel').SwapRequestCaptionDisplayData} SwapRequestCaptionDisplayData */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Token').TokenInfo} TokenInfo */

/**
 * Creates an object containing chain name and the resolved token icon.
 * @param {ChainName} chainName - The side's chain.
 * @param {TokenInfo} tokenInfo - The side's token.
 * @param {NetworkIdentifier} networkIdentifier - Network identifier.
 * @returns {{ chainName: ChainName, imageId: string|null }} Side display data.
 */
const createChainDisplayData = (chainName, tokenInfo, networkIdentifier) => ({
	chainName,
	imageId: createTokenDisplayData(tokenInfo, chainName, networkIdentifier).imageId
});

/**
 * Creates the amount display text with a ticker from the swap request.
 * @param {BridgeRequest|BridgeError} request - The history item.
 * @param {NetworkIdentifier} networkIdentifier - Network identifier.
 * @returns {{ value: string, ticker: string }|null} Amount display data.
 */
const createAmountDisplayData = (request, networkIdentifier) => {
	const { payoutTransaction, targetChainName } = request;

	if (!payoutTransaction)
		return null;

	return {
		value: payoutTransaction.token.amount,
		ticker: createTokenDisplayData(payoutTransaction.token, targetChainName, networkIdentifier).tickerText
	};
};

/**
 * Creates the display data for the swap request caption. Showing when transaction is confirmed or failed.
 * @param {BridgeRequest|BridgeError} request - The history item.
 * @returns {SwapRequestCaptionDisplayData} Caption display information.
 */
const createSwapRequestCaptionDisplayData = request => {
	const { requestStatus, errorMessage } = request;

	let isVisible;
	let text;
	let textStyle;
	let textType;

	switch (requestStatus) {
	case BridgeRequestStatus.CONFIRMED:
		isVisible = true;
		text = $t('s_bridge_history_requestTransactionConfirmed');
		textStyle = 'regular';
		textType = 'body';
		break;
	case BridgeRequestStatus.ERROR:
		isVisible = true;
		text = errorMessage;
		textStyle = 'error';
		textType = 'label';
		break;
	default:
		isVisible = false;
		text = null;
		textStyle = null;
		textType = null;
	}

	return { isVisible, text, textStyle, textType };
};

/**
 * Creates a single history row.
 * @param {BridgeRequest|BridgeError} request - The history item.
 * @param {NetworkIdentifier} networkIdentifier - Network identifier.
 * @returns {SwapHistoryItem} The row.
 */
const createHistoryItem = (request, networkIdentifier) => ({
	key: request.requestTransaction.hash,
	actionText: $t('transactionDescriptor_swap'),
	dateText: formatDate(request.requestTransaction.timestamp, $t),
	source: createChainDisplayData(request.sourceChainName, request.sourceTokenInfo, networkIdentifier),
	target: createChainDisplayData(request.targetChainName, request.targetTokenInfo, networkIdentifier),
	status: request.payoutStatus === undefined ? null : createSwapStatusDisplayData(request.requestStatus, request.payoutStatus),
	amount: createAmountDisplayData(request, networkIdentifier),
	caption: createSwapRequestCaptionDisplayData(request),
	isPending: request.requestStatus === BridgeRequestStatus.CONFIRMED,
	request
});

/**
 * Creates the swap history view model.
 * @param {object} params - Builder parameters.
 * @param {(BridgeRequest|BridgeError)[]} params.history - Recent requests in list order; empty while no route is selected.
 * @param {NetworkIdentifier} params.networkIdentifier - Network of the selected route.
 * @returns {SwapHistoryViewModel} The history view model.
 */
export const createSwapHistoryViewModel = ({ history, networkIdentifier }) => ({
	items: history.map(request => createHistoryItem(request, networkIdentifier)),
	pageSizeText: history.length === BRIDGE_HISTORY_PAGE_SIZE
		? $t('s_bridge_history_page_size_message', { size: BRIDGE_HISTORY_PAGE_SIZE })
		: ''
});
