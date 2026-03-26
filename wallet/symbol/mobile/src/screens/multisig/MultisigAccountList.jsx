import { MultisigAccountListItem } from './components';
import { useMultisigAccountList } from './hooks';
import { ButtonCircle, EmptyListMessage, Screen, ScreenIllustration, Spacer, Stack, StyledText } from '@/app/components';
import { useInit, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import React from 'react';

/**
 * MultisigAccountList screen component. Displays a list of multisig accounts for the
 * currently selected wallet account and allows opening multisig account details.
 * @returns {React.ReactNode} MultisigAccountList component
 */
export const MultisigAccountList = () => {
	const walletController = useWalletController();
	const {
		chainName,
		networkIdentifier,
		ticker,
		accounts,
		isWalletReady
	} = walletController;
	const { addressBook } = walletController.modules;
	const walletAccounts = accounts[networkIdentifier];

	const { data: multisigAccountList, refresh, isLoading } = useMultisigAccountList(walletController);

	const openAccount = accountInfo => {
		Router.goToMultisigAccountDetails({
			params: {
				chainName,
				accountAddress: accountInfo.address,
				preloadedData: accountInfo
			}
		});
	};

	const createMultisigAccount = () => {
		Router.goToCreateMultisigAccount({
			params: {
				chainName
			}
		});
	};

	useInit(refresh, isWalletReady);

	return (
		<Screen refresh={{ onRefresh: refresh, isRefreshing: isLoading }}>
			<Screen.Header>
				<ScreenIllustration name="multisig-account" />
			</Screen.Header>
			<Screen.Upper>
				<Spacer>
					<StyledText type="title">
						{$t('s_multisig_accountList_title')}
					</StyledText>
					<StyledText type="body">
						{$t('s_multisig_accountList_description')}
					</StyledText>
				</Spacer>
				<Spacer>
					<Stack gap="s">
						{multisigAccountList.map(accountInfo => (
							<MultisigAccountListItem
								key={accountInfo.address}
								address={accountInfo.address}
								balance={accountInfo.balance}
								ticker={ticker}
								walletAccounts={walletAccounts}
								addressBook={addressBook}
								chainName={chainName}
								networkIdentifier={networkIdentifier}
								onPress={() => openAccount(accountInfo)}
							/>
						))}
						{multisigAccountList.length === 0 && (
							<EmptyListMessage />
						)}
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<ButtonCircle
					icon='account-add'
					isFloating
					onPress={createMultisigAccount}
				/>
			</Screen.Bottom>
		</Screen>
	);
};
