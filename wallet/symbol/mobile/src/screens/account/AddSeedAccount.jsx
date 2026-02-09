import { AccountCard, BasicList } from './components';
import { useSeedAccountBalances } from './hooks';
import { ButtonPlain, Screen, Stack, StyledText, TextBox } from '@/app/components';
import { useAsyncManager, useValidation, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { validateAccountName } from '@/app/utils';
import React, { useMemo, useState } from 'react';
import { WalletAccountType } from 'wallet-common-core/src/constants';

const DEFAULT_BALANCE_PLACEHOLDER = '..';

const getDefaultAccountName = index => $t('s_addAccount_seed_name_default', { index });

/**
 * AddSeedAccount screen component. Allows users to add a new seed account
 * by entering a custom name and selecting from available seed addresses.
 */
export const AddSeedAccount = () => {
	const walletController = useWalletController();
	const {
		accounts,
		seedAddresses,
		networkIdentifier,
		networkProperties,
		networkApi,
		ticker
	} = walletController;

	// Derived data
	const availableSeedAccounts = useMemo(
		() => {
			const networkAccounts = accounts[networkIdentifier] || [];
			const networkSeedAccounts = seedAddresses[networkIdentifier] ?? [];
			return networkSeedAccounts.filter(seedAccount =>
				!networkAccounts.some(account =>
					account.address === seedAccount.address));
		},
		[networkIdentifier, accounts, seedAddresses]
	);

	// Account name
	const [accountName, setAccountName] = useState('');
	const nameErrorMessage = useValidation(accountName, [validateAccountName()], $t);
	const hasValidName = !nameErrorMessage && accountName.trim().length > 0;

	// Balance fetching
	const { accountBalances } = useSeedAccountBalances({
		seedAccounts: availableSeedAccounts,
		networkProperties,
		networkApi
	});

	// Add account
	const addAccountManager = useAsyncManager({
		callback: async account => {
			const name = hasValidName
				? accountName.trim()
				: getDefaultAccountName(account.index);

			await walletController.addSeedAccount({
				type: WalletAccountType.MNEMONIC,
				name,
				networkIdentifier,
				index: account.index
			});

			Router.goBack();
		}
	});
	const handleAccountPress = account => {
		addAccountManager.call(account);
	};

	// Render
	const renderHeader = () => (
		<Stack>
			<StyledText type="title">{$t('s_addAccount_name_title')}</StyledText>
			<TextBox
				label={$t('s_addAccount_name_input')}
				errorMessage={nameErrorMessage}
				value={accountName}
				onChange={setAccountName}
			/>
			<StyledText type="body">{$t('s_addAccount_seed_description')}</StyledText>
			<ButtonPlain
				icon="key"
				text={$t('button_addExternalAccount')}
				onPress={() => Router.goToAddExternalAccount()}
			/>
			<StyledText type="title">{$t('s_addAccount_select_title')}</StyledText>
		</Stack>
	);

	const renderSeedAccountItem = ({ item }) => {
		const name = getDefaultAccountName(item.index);
		const balanceInfo = accountBalances[item.publicKey];
		const balance = balanceInfo?.balance ?? DEFAULT_BALANCE_PLACEHOLDER;
		const isLoading = balanceInfo?.isLoading ?? true;

		return (
			<AccountCard
				name={name}
				address={item.address}
				balance={balance}
				ticker={ticker}
				isLoading={isLoading}
			/>
		);
	};
	
	const keyExtractor = item => item.publicKey;
	const {isLoading} = addAccountManager;

	return (
		<Screen isScrollDisabled isLoading={isLoading}>
			<BasicList
				data={availableSeedAccounts}
				renderItem={renderSeedAccountItem}
				renderHeader={renderHeader}
				keyExtractor={keyExtractor}
				onItemPress={handleAccountPress}
			/>
		</Screen>
	);
};
