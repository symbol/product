import { getAccountKnownInfo, getTokenKnownInfo } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequest} BridgeRequest */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSideDisplayData} SwapSideDisplayData */

/**
 * Extracts and formats source side data from a bridge request.
 * @param {BridgeRequest} data - The bridge request data.
 * @param {WalletController} sourceWalletController - The source wallet controller.
 * @returns {SwapSideDisplayData} Formatted source side data.
 */
export const getSwapSourceData = (data, sourceWalletController) => {
	const { sourceChainName, sourceTokenInfo, requestTransaction } = data;
	const { networkIdentifier } = sourceWalletController;

	const sourceTokenKnownInfo = getTokenKnownInfo(
		sourceChainName,
		networkIdentifier,
		sourceTokenInfo.id
	);

	let account = null;
	if (requestTransaction) {
		const sourceAddressKnownInfo = getAccountKnownInfo(requestTransaction.signerAddress, {
			walletAccounts: sourceWalletController.accounts[networkIdentifier],
			addressBook: sourceWalletController.modules.addressBook,
			chainName: sourceWalletController.chainName,
			networkIdentifier
		});
		account = {
			address: requestTransaction.signerAddress,
			name: sourceAddressKnownInfo.name,
			imageId: sourceAddressKnownInfo.imageId
		};
	}

	return {
		chainName: sourceChainName,
		networkIdentifier,
		token: {
			name: sourceTokenKnownInfo.name ?? sourceTokenInfo.name,
			ticker: sourceTokenKnownInfo.ticker,
			imageId: sourceTokenKnownInfo.imageId,
			amount: requestTransaction?.token?.amount ?? null
		},
		account: account,
		transactionHash: requestTransaction?.hash ?? null
	};
};

/**
 * Extracts and formats target side data from a bridge request.
 * @param {BridgeRequest} data - The bridge request data.
 * @param {WalletController} targetWalletController - The target wallet controller.
 * @returns {SwapSideDisplayData} Formatted target side data.
 */
export const getSwapTargetData = (data, targetWalletController) => {
	const { targetChainName, targetTokenInfo, payoutTransaction } = data;
	const { networkIdentifier } = targetWalletController;

	const targetTokenKnownInfo = getTokenKnownInfo(
		targetChainName,
		networkIdentifier,
		targetTokenInfo.id
	);

	let account = null;
	if (payoutTransaction) {
		const targetAddressKnownInfo = getAccountKnownInfo(payoutTransaction.recipientAddress, {
			walletAccounts: targetWalletController.accounts[networkIdentifier],
			addressBook: targetWalletController.modules.addressBook,
			chainName: targetWalletController.chainName,
			networkIdentifier
		});
		account = {
			address: payoutTransaction.recipientAddress,
			name: targetAddressKnownInfo.name,
			imageId: targetAddressKnownInfo.imageId
		};
	}

	return {
		chainName: targetChainName,
		networkIdentifier,
		token: {
			name: targetTokenKnownInfo.name ?? targetTokenInfo.name,
			ticker: targetTokenKnownInfo.ticker,
			imageId: targetTokenKnownInfo.imageId,
			amount: payoutTransaction?.token?.amount ?? null
		},
		account: account,
		transactionHash: payoutTransaction?.hash ?? null
	};
};
