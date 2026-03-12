import { AccountCard, DraggableList } from './components';
import { useAccountBalances } from './hooks';
import { ButtonCircle, DialogBox, Screen } from '@/app/components';
import { useAsyncManager, useProp, useToggle, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import React, { useMemo, useState } from 'react';
import { WalletAccountType } from 'wallet-common-core/src/constants';

const ROOT_ACCOUNT_INDEX = 0;

/**
 * AccountList screen component. Displays a draggable list of accounts for the current network,
 * allowing users to select, reorder, and remove accounts.
 */
export const AccountList = () => {
	const walletController = useWalletController();
	const {
		currentAccount,
		accounts,
		networkIdentifier,
		ticker
	} = walletController;

	const selectedPublicKey = currentAccount?.publicKey || null;
	const networkAccounts = useMemo(
		() => accounts[networkIdentifier] || [],
		[accounts, networkIdentifier]
	);

	const isAccountSelected = account => account.publicKey === selectedPublicKey;
	const isRootAccount = account => account.index === ROOT_ACCOUNT_INDEX;
	const isExternalAccount = account => account.accountType === WalletAccountType.EXTERNAL;

	// Balance fetching
	const { accountBalances } = useAccountBalances(walletController);

	// Select account
	const selectAccountManager = useAsyncManager({
		callback: async account => {
			await walletController.selectAccount(account.publicKey);
			Router.goBack();
		}
	});
	const handleAccountPress = account => {
		selectAccountManager.call(account);
	};

	// Reorder accounts
	const [orderedAccounts, setOrderedAccounts] = useProp(networkAccounts, networkAccounts);
	const saveAccountsOrderManager = useAsyncManager({
		callback: async data => await walletController.changeAccountsOrder(networkIdentifier, data)
	});
	const handleOrderChange = data => {
		setOrderedAccounts(data);
		saveAccountsOrderManager.call(data);
	};

	// Remove account
	const [isRemoveDialogVisible, toggleRemoveDialog] = useToggle(false);
	const [accountToRemove, setAccountToRemove] = useState(null);
	const removeAccountManager = useAsyncManager({
		callback: async account => {
			// If removing the currently selected account, select the root account first
			if (account.publicKey === selectedPublicKey) {
				const rootAccount = networkAccounts[ROOT_ACCOUNT_INDEX];
				await walletController.selectAccount(rootAccount.publicKey);
			}

			await walletController.removeAccount({
				publicKey: account.publicKey,
				networkIdentifier
			});
		}
	});
	const handleRemovePress = account => {
		if (isExternalAccount(account)) {
			setAccountToRemove(account);
			toggleRemoveDialog();
		} else {
			removeAccountManager.call(account);
		}
	};
	const handleConfirmRemove = () => {
		removeAccountManager.call(accountToRemove);
		toggleRemoveDialog();
	};

	// Renderers
	const renderAccountCard = ({ item }) => {
		const balanceInfo = accountBalances[item.publicKey] || {};
		const canRemove = !isRootAccount(item);

		return (
			<AccountCard
				name={item.name}
				address={item.address}
				balance={balanceInfo.balance}
				balanceChange={balanceInfo.balanceChange}
				ticker={ticker}
				accountType={item.accountType}
				isActive={isAccountSelected(item)}
				onRemove={canRemove ? () => handleRemovePress(item) : null}
			/>
		);
	};

	const keyExtractor = item => item.publicKey;

	return (
		<Screen isScrollDisabled>
			<DraggableList
				data={orderedAccounts}
				renderItem={renderAccountCard}
				keyExtractor={keyExtractor}
				onItemPress={handleAccountPress}
				onOrderChange={handleOrderChange}
			/>
			<ButtonCircle
				icon='account-add'
				isFloating
				onPress={Router.goToAddSeedAccount}
			/>
			<DialogBox
				type="confirm"
				title={$t('s_accountList_confirm_removeExternal_title')}
				text={$t('s_accountList_confirm_removeExternal_body', accountToRemove)}
				isVisible={isRemoveDialogVisible}
				onSuccess={handleConfirmRemove}
				onCancel={toggleRemoveDialog}
			/>
		</Screen>
	);
};
