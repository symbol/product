import { useAsyncManager } from '@/app/hooks';
import { showError } from '@/app/utils';
import { useCallback, useEffect, useState } from 'react';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/Token').Token} Token */

/**
 * Return type for useSenderInfo hook.
 * @typedef {Object} UseSenderInfoReturnType
 * @property {Token[]} senderTokenList - List of tokens owned by the sender.
 * @property {string} senderPublicKey - The sender's public key.
 * @property {boolean} isLoading - Whether sender info is being fetched.
 */

/**
 * React hook for fetching and managing sender account information.
 * Loads tokens and public key for the selected sender address.
 *
 * @param {Object} params - Hook parameters.
 * @param {WalletController} params.walletController - The wallet controller instance.
 * @param {string} params.senderAddress - The sender account address.
 * @param {string|null} params.selectedTokenId - Currently selected token ID.
 * @param {(tokenId: string|null) => void} params.onTokenIdChange - Callback when token ID should change.
 * @returns {UseSenderInfoReturnType}
 */
export const useSenderInfo = ({
	walletController,
	senderAddress,
	selectedTokenId,
	onTokenIdChange
}) => {
	const {
		currentAccount,
		currentAccountInfo,
		networkProperties
	} = walletController;

	const [senderTokenList, setSenderTokenList] = useState([]);
	const [senderPublicKey, setSenderPublicKey] = useState(currentAccount.publicKey);

	/**
	 * Updates sender info with token list and public key.
	 * @param {Token[]} tokens - List of tokens.
	 * @param {string} publicKey - The public key.
	 */
	const updateSenderInfo = useCallback((tokens, publicKey) => {
		const preferredToken = tokens.find(token => token.id === selectedTokenId);

		setSenderTokenList(tokens);
		onTokenIdChange(preferredToken?.id || tokens[0]?.id || null);
		setSenderPublicKey(publicKey);
	}, [selectedTokenId, onTokenIdChange]);

	const senderInfoManager = useAsyncManager({
		callback: async sender => {
			const { mosaics, tokens, publicKey } = await walletController.networkApi.account.fetchAccountInfo(
				networkProperties,
				sender
			);
			const tokenList = (tokens && tokens.length) ? tokens : (mosaics || []);

			updateSenderInfo(tokenList, publicKey);
		},
		onError: error => {
			showError(error);
			updateSenderInfo([], '');
		}
	});

	// Fetch sender info when address changes
	useEffect(() => {
		onTokenIdChange(null);
		const currentTokens = (currentAccountInfo?.tokens && currentAccountInfo.tokens.length)
			? currentAccountInfo.tokens
			: (currentAccountInfo?.mosaics || []);

		if (currentAccount.address === senderAddress)
			updateSenderInfo(currentTokens, currentAccount.publicKey);
		else
			senderInfoManager.call(senderAddress);
	}, [currentAccount, currentAccountInfo?.mosaics, currentAccountInfo?.tokens, senderAddress]);

	return {
		senderTokenList,
		senderPublicKey,
		isLoading: senderInfoManager.isLoading
	};
};
