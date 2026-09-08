import { getSwapStatus } from './swap-status';
import { ActivityStatus } from '@/app/constants';
import { $t } from '@/app/localization';
import { BridgePayoutStatus, BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { createTokenDisplayData, formatDate, getAccountKnownInfo } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeError} BridgeError */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgePayoutStatusType} BridgePayoutStatusType */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequest} BridgeRequest */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequestStatusType} BridgeRequestStatusType */
/** @typedef {import('@/app/screens/bridge/types/ViewModel').ResolvedAccountData} ResolvedAccountData */
/** @typedef {import('@/app/screens/bridge/types/ViewModel').ResolvedTokenData} ResolvedTokenData */
/** @typedef {import('@/app/screens/bridge/types/ViewModel').SwapDetailsViewModel} SwapDetailsViewModel */
/** @typedef {import('@/app/screens/bridge/types/ViewModel').SwapSideDisplayData} SwapSideDisplayData */
/** @typedef {import('@/app/types/ActivityLog').ActivityLogItem} ActivityLogItem */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Token').TokenInfo} TokenInfo */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('wallet-common-core/src/types/Bridge').PayoutTransaction} PayoutTransaction */
/** @typedef {import('wallet-common-core/src/types/Bridge').RequestTransaction} RequestTransaction */

/**
 * Parameters for activity log construction.
 * @typedef {object} BuildActivityLogParams
 * @property {BridgeRequestStatusType} requestStatus - Request transaction status.
 * @property {BridgePayoutStatusType} [payoutStatus] - Payout transaction status.
 * @property {number} [requestTimestamp] - Request transaction timestamp.
 * @property {number} [payoutTimestamp] - Payout transaction timestamp.
 * @property {string} [errorMessage] - Error message if failed.
 */

/**
 * Creates the account display data for a given address using info from the specific wallet controller.
 * @param {string} address - Signer or recipient address.
 * @param {WalletController} walletController - The side's wallet controller.
 * @returns {ResolvedAccountData} Account display data.
 */
const createAccountDisplayData = (address, walletController) => {
	const { networkIdentifier } = walletController;
	const knownInfo = getAccountKnownInfo(address, {
		walletAccounts: walletController.accounts[networkIdentifier],
		addressBook: walletController.modules.addressBook,
		chainName: walletController.chainName,
		networkIdentifier
	});

	return {
		address,
		name: knownInfo.name,
		imageId: knownInfo.imageId
	};
};

/**
 * Creates the token display data for a given token info and transaction.
 * @param {TokenInfo} tokenInfo - The side's token.
 * @param {RequestTransaction|PayoutTransaction|undefined} transaction - The side's transaction.
 * @param {ChainName} chainName - The side's chain.
 * @param {NetworkIdentifier} networkIdentifier - Network identifier.
 * @returns {ResolvedTokenData} Token display data.
 */
const createTokenData = (tokenInfo, transaction, chainName, networkIdentifier) => {
	const { plainName, ticker, imageId } = createTokenDisplayData(tokenInfo, chainName, networkIdentifier);

	return {
		name: plainName,
		ticker,
		imageId,
		amount: transaction?.token?.amount ?? null
	};
};

/**
 * Creates the display data for a swap side using its transaction, token, and chain.
 * @param {object} params - Side parameters.
 * @param {ChainName} params.chainName - The side's chain.
 * @param {TokenInfo} params.tokenInfo - The side's token.
 * @param {RequestTransaction|PayoutTransaction|undefined} params.transaction - The side's transaction; absent before it exists.
 * @param {string|undefined} params.address - Signer (source) or recipient (target) of that transaction.
 * @param {WalletController} params.walletController - The side's wallet controller.
 * @returns {SwapSideDisplayData} Side display data.
 */
const createSideDisplayData = ({ chainName, tokenInfo, transaction, address, walletController }) => ({
	chainName,
	networkIdentifier: walletController.networkIdentifier,
	token: createTokenData(tokenInfo, transaction, chainName, walletController.networkIdentifier),
	account: transaction ? createAccountDisplayData(address, walletController) : null,
	transactionHash: transaction?.hash ?? null
});

/**
 * Builds the swap activity log steps.
 * @param {BuildActivityLogParams} params - Parameters for building the activity log.
 * @returns {ActivityLogItem[]} Activity log steps.
 */
export const buildActivityLog = ({
	requestStatus,
	payoutStatus,
	requestTimestamp,
	payoutTimestamp,
	errorMessage
}) => {
	const isRequestConfirmed = requestStatus === BridgeRequestStatus.CONFIRMED;
	const isRequestFailed = requestStatus === BridgeRequestStatus.ERROR;
	const isBridgeWorking = payoutStatus === BridgePayoutStatus.UNPROCESSED;
	const isPayoutFailed = payoutStatus === BridgePayoutStatus.FAILED;
	const isPayoutSent = payoutStatus === BridgePayoutStatus.SENT;
	const isPayoutConfirmed = payoutStatus === BridgePayoutStatus.COMPLETED;

	const requestTimestampText = requestTimestamp
		? formatDate(requestTimestamp, $t, true)
		: '';
	const payoutTimestampText = payoutTimestamp
		? formatDate(payoutTimestamp, $t, true)
		: '';

	return [
		{
			title: $t('s_bridge_swapStatus_step_requestSend'),
			icon: 'send-plane',
			status: ActivityStatus.COMPLETE,
			caption: requestTimestampText
		},
		{
			title: $t('s_bridge_swapStatus_step_awaitingBridge'),
			icon: 'pending',
			status: isBridgeWorking || isPayoutFailed || isPayoutSent || isPayoutConfirmed
				? ActivityStatus.COMPLETE
				: isRequestConfirmed
					? ActivityStatus.LOADING
					: isRequestFailed
						? ActivityStatus.ERROR
						: ActivityStatus.PENDING,
			caption: isRequestFailed ? errorMessage : ''
		},
		{
			title: $t('s_bridge_swapStatus_step_payoutSend'),
			icon: 'swap',
			status: isPayoutFailed
				? ActivityStatus.ERROR
				: isPayoutSent || isPayoutConfirmed
					? ActivityStatus.COMPLETE
					: isBridgeWorking
						? ActivityStatus.LOADING
						: ActivityStatus.PENDING,
			caption: isPayoutFailed ? errorMessage : ''
		},
		{
			title: $t('s_bridge_swapStatus_step_payoutConfirmation'),
			icon: 'check',
			status: isPayoutConfirmed
				? ActivityStatus.COMPLETE
				: isPayoutSent
					? ActivityStatus.LOADING
					: ActivityStatus.PENDING,
			caption: payoutTimestampText
		}
	];
};

/**
 * Creates the swap details view model.
 * @param {object} params - Builder parameters.
 * @param {BridgeRequest|BridgeError} params.request - The swap to show.
 * @param {WalletController} params.sourceWalletController - Wallet controller of the source chain.
 * @param {WalletController} params.targetWalletController - Wallet controller of the target chain.
 * @returns {SwapDetailsViewModel} The details view model.
 */
export const createSwapDetailsViewModel = ({ request, sourceWalletController, targetWalletController }) => ({
	status: getSwapStatus(request.requestStatus, request.payoutStatus),
	source: createSideDisplayData({
		chainName: request.sourceChainName,
		tokenInfo: request.sourceTokenInfo,
		transaction: request.requestTransaction,
		address: request.requestTransaction?.signerAddress,
		walletController: sourceWalletController
	}),
	target: createSideDisplayData({
		chainName: request.targetChainName,
		tokenInfo: request.targetTokenInfo,
		transaction: request.payoutTransaction,
		address: request.payoutTransaction?.recipientAddress,
		walletController: targetWalletController
	}),
	activityLog: buildActivityLog({
		requestStatus: request.requestStatus,
		payoutStatus: request.payoutStatus,
		requestTimestamp: request.requestTransaction?.timestamp,
		payoutTimestamp: request.payoutTransaction?.timestamp,
		errorMessage: request.errorMessage
	})
});
