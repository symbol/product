import { AccountCard, BasicList } from './components';
import { useAccountSaver, useExternalAccountState, useSeedAccountBalances } from './hooks';
import { Alert, ButtonPlain, DialogBox, Divider, Screen, Stack, StyledText, TextBox } from '@/app/components';
import { useValidation, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { validateAccountName } from '@/app/utils';
import { useMemo, useState } from 'react';

const DEFAULT_BALANCE_PLACEHOLDER = '..';

const getDefaultAccountName = index => $t('screen_account_title_seedAccount', { index });

/**
 * AddSeedAccount screen component. Allows users to add a new seed account
 * by entering a custom name and selecting from available seed addresses.
 * Also supports adding external accounts via private key through a dialog interface.
 */
export const AddSeedAccount = () => {
	const walletController = useWalletController();
	const {
		accounts,
		seedAddresses,
		networkIdentifier,
		networkProperties,
		networkApi,
		chainName,
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

	// Seed account name
	const [accountNameInput, setAccountName] = useState('');
	const nameErrorMessage = useValidation(accountNameInput, [validateAccountName()], $t);
	const accountName = accountNameInput.trim();
	const isNameValid = !nameErrorMessage;

	// External account
	const externalAccountState = useExternalAccountState({ initialName: accountName, chainName });

	// Balance fetching
	const { accountBalances } = useSeedAccountBalances({
		seedAccounts: availableSeedAccounts,
		networkProperties,
		networkApi
	});

	// Add (save) account logic
	const { saveMnemonicAccount, saveExternalAccount, isSaving } = useAccountSaver({
		walletController,
		onSaveComplete: Router.goBack
	});

	// Handlers
	const handleAccountPress = account => {
		if (!isNameValid)
			return;

		const name = accountName || getDefaultAccountName(account.index);
		saveMnemonicAccount(name, account.index);
	};
	const handleExternalAccountSubmit = () => {
		if (externalAccountState.isFormError)
			return;

		saveExternalAccount(externalAccountState.accountName, externalAccountState.privateKey);
	};


	// Render
	const renderHeader = () => (
		<Stack>
			<StyledText type="title">{$t('screen_account_title_accountName')}</StyledText>
			<TextBox
				label={$t('inputLabel_name')}
				errorMessage={nameErrorMessage}
				value={accountNameInput}
				onChange={setAccountName}
			/>
			<StyledText type="body">{$t('screen_account_description_seedAccount')}</StyledText>
			<ButtonPlain
				icon="key"
				text={$t('button_importAccount')}
				onPress={externalAccountState.showDialog}
			/>
			<StyledText type="title">{$t('screen_account_title_selectAccount')}</StyledText>
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

	return (
		<Screen isScrollDisabled isLoading={isSaving}>
			<Screen.Upper>
				<BasicList
					data={availableSeedAccounts}
					renderItem={renderSeedAccountItem}
					renderHeader={renderHeader}
					keyExtractor={keyExtractor}
					onItemPress={handleAccountPress}
				/>
			</Screen.Upper>
			<Screen.Modals>
				<DialogBox
					type="confirm"
					title={$t('screen_account_dialog_importPrivateKey_title')}
					isVisible={externalAccountState.isDialogVisible}
					isDisabled={externalAccountState.isFormError}
					onSuccess={handleExternalAccountSubmit}
					onCancel={externalAccountState.hideDialog}
				>
					<Stack>
						<StyledText>
							{$t('screen_account_dialog_importPrivateKey_description')}
						</StyledText>
						<Alert
							variant="warning"
							body={$t('screen_account_alert_privateKeyWarning_description')}
						/>
						<TextBox
							label={$t('inputLabel_name')}
							errorMessage={externalAccountState.nameErrorMessage}
							value={externalAccountState.accountNameInput}
							onChange={externalAccountState.setAccountName}
						/>
						<TextBox
							label={$t('inputLabel_privateKey')}
							errorMessage={externalAccountState.privateKeyErrorMessage}
							value={externalAccountState.privateKeyInput}
							onChange={externalAccountState.setPrivateKey}
						/>
						<Divider />
					</Stack>
				</DialogBox>
			</Screen.Modals>
		</Screen>
	);
};
