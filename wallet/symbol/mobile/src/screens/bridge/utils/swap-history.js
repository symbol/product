import { getSwapStatus, getSwapStatusCaption } from './swap-status';
import { $t } from '@/app/localization';
import { BRIDGE_HISTORY_PAGE_SIZE } from '@/app/screens/bridge/constants';
import { BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { createTokenDisplayData, formatDate } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeError} BridgeError */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequest} BridgeRequest */
/** @typedef {import('@/app/screens/bridge/types/ViewModel').SwapHistoryItem} SwapHistoryItem */
/** @typedef {import('@/app/screens/bridge/types/ViewModel').SwapHistoryViewModel} SwapHistoryViewModel */
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
const createAmount = (request, networkIdentifier) => {
	const { payoutTransaction, targetChainName } = request;

	if (!payoutTransaction)
		return null;

	return {
		value: payoutTransaction.token.amount,
		ticker: createTokenDisplayData(payoutTransaction.token, targetChainName, networkIdentifier).tickerText
	};
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
	status: request.payoutStatus === undefined ? null : getSwapStatus(request.requestStatus, request.payoutStatus),
	amount: createAmount(request, networkIdentifier),
	caption: getSwapStatusCaption(request),
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
