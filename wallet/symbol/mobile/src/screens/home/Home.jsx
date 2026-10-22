import { Header } from '@/app/app/components';
import { MultisigAccountWarning, Screen, Spacer, Stack, StyledText, WidgetAnimatedWrapper } from '@/app/components';
import { useInit, useRefreshController, useWalletController } from '@/app/hooks';
import { useAsyncManager } from '@/app/hooks/useAsyncManager';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { HistoryHomeWidget } from '@/app/screens/history/widgets/HistoryHomeWidget';
import { AccountCardWidget } from '@/app/screens/home/components/AccountCardWidget';
import { homeScreenConfig } from '@/brand/config/home-screen-config';
import React from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';

/**
 * Home screen component. The main dashboard screen displaying the current account's balance, name,
 * and providing navigation to send transaction, view account details, and receive QR-code screens.
 * @returns {React.ReactNode} Home component.
 */
export const Home = () => {
	const walletController = useWalletController();
	const { currentAccount, currentAccountInfo, networkIdentifier } = walletController;

	const isMultisigAccount = currentAccountInfo?.isMultisig ?? false;

	// Account rename manager
	const renameManager = useAsyncManager({
		callback: async name => walletController.renameAccount({
			publicKey: currentAccount.publicKey,
			name,
			networkIdentifier
		})
	});

	// Data fetching
	const refreshController = useRefreshController();
	const fetchData = () => {
		walletController.fetchAccountInfo();
		refreshController.refresh();
	};

	useInit(walletController.fetchAccountInfo, walletController.isWalletReady);

	return (
		<Screen refresh={{ onRefresh: fetchData }}>
			<Screen.Header>
				<Header currentAccount={currentAccount} />
			</Screen.Header>
			<Screen.Upper>
				<Spacer>
					<Stack gap="l">
						<Animated.View entering={FadeInUp}>
							<AccountCardWidget
								address={currentAccount?.address ?? ''}
								balance={currentAccountInfo?.balance ?? '0'}
								name={currentAccount?.name ?? ''}
								price={walletController.modules.market.price}
								ticker={walletController.ticker}
								networkIdentifier={walletController.networkIdentifier}
								isMultisig={isMultisigAccount}
								onNameChange={renameManager.call}
								onSwapPress={Router.goToBridgeSwap}
								onSendPress={Router.goToSend}
								onDetailsPress={Router.goToAccountDetails}
							/>
						</Animated.View>

						{isMultisigAccount && (
							<Animated.View entering={FadeInUp}>
								<MultisigAccountWarning
									cosignatories={currentAccountInfo.cosignatories}
									addressBook={walletController.modules.addressBook}
									accounts={walletController.accounts[networkIdentifier]}
									chainName={walletController.chainName}
									networkIdentifier={networkIdentifier}
								/>
							</Animated.View>
						)}

						<HistoryHomeWidget refreshController={refreshController} />

						<Stack gap="m">
							<WidgetAnimatedWrapper isVisible>
								<StyledText type="title">
									{$t('screen_home_title_widgets')}
								</StyledText>
							</WidgetAnimatedWrapper>
							{homeScreenConfig.widgets.map(({ id, Component }) => (
								<Component key={id} refreshController={refreshController} />
							))}
						</Stack>
					</Stack>
				</Spacer>
			</Screen.Upper>
		</Screen>
	);
};
