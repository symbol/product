import { useAsyncManager } from '@/app/hooks';
import { useCallback } from 'react';
import { WalletAccountType } from 'wallet-common-core/src/constants';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Return type for useAccountSaver hook.
 * @typedef {object} UseAccountSaverReturnType
 * @property {(name: string, index: number) => void} saveMnemonicAccount 
 * - Saves a mnemonic-derived account with the provided name and index.
 * @property {(name: string, privateKey: string) => void} saveExternalAccount 
 * - Saves an external account with the provided name and private key.
 * @property {boolean} isSaving - Whether an account save operation is currently in progress.
 * @property {*} saveError - The error from the last failed save operation, if any.
 */

/**
 * React hook for managing account creation save actions.
 * Provides save handlers for mnemonic and external accounts together with loading and error state.
 * @param {object} params - Hook parameters.
 * @param {WalletController} params.walletController - The wallet controller instance to manage accounts.
 * @param {() => void} params.onSaveComplete - Callback invoked after a successful save operation.
 * @returns {UseAccountSaverReturnType}
 */
export const useAccountSaver = ({ walletController, onSaveComplete }) => {
	const { networkIdentifier } = walletController;
	const addAccountManager = useAsyncManager({
		callback: async account => {
			if (account.type === WalletAccountType.MNEMONIC)
				return walletController.addSeedAccount(account);

			if (account.type === WalletAccountType.EXTERNAL)
				return walletController.addExternalAccount(account);
		},
		onSuccess: onSaveComplete
	});

	const saveMnemonicAccount = useCallback((name, index) => {
		addAccountManager.call({
			type: WalletAccountType.MNEMONIC,
			networkIdentifier,
			name,
			index
		});
	}, [networkIdentifier]);

	const saveExternalAccount = useCallback((name, privateKey) => {
		addAccountManager.call({
			type: WalletAccountType.EXTERNAL,
			networkIdentifier,
			name,
			privateKey
		});
	}, [networkIdentifier]);

	return {
		saveMnemonicAccount,
		saveExternalAccount,
		isSaving: addAccountManager.isLoading,
		saveError: addAccountManager.error
	};
};
