import { Header } from '@/app/app/components';
import { Screen, Spacer, Stack } from '@/app/components';
import { useInit, useWalletController } from '@/app/hooks';
import { useAsyncManager } from '@/app/hooks/useAsyncManager';
import { Router } from '@/app/router/Router';
import { useHistoryWidget } from '@/app/screens/history/hooks';
import { HistoryWidget } from '@/app/screens/history/widgets/HistoryWidget';
import { AccountCardWidget } from '@/app/screens/home/components/AccountCardWidget';
import React from 'react';
import Animated, { FadeInDown, FadeInUp, FadeOutUp } from 'react-native-reanimated';

/**
 * Home screen component. The main dashboard screen displaying the current account's balance, name,
 * and providing navigation to send transaction, view account details, and receive QR-code screens.
 */
export const Home = () => {
	const walletController = useWalletController();
	const { currentAccount, currentAccountInfo, networkIdentifier } = walletController;

	// Account rename manager
	const renameManager = useAsyncManager({
		callback: async name => walletController.renameAccount({
			publicKey: currentAccount.publicKey,
			name,
			networkIdentifier
		})
	});

	// Widgets
	const historyWidget = useHistoryWidget(walletController);

	// Data fetching
	const fetchData = () => {
		walletController.fetchAccountInfo();
		historyWidget.refresh();
	};

	useInit(fetchData, walletController.isWalletReady);

	return (
		<Screen refresh={{ onRefresh: fetchData }}>
			<Screen.Header>
				<Header currentAccount={currentAccount} />
			</Screen.Header>
			<Screen.Upper>
				<Spacer>
					<Stack>
						<Animated.View entering={FadeInUp}>
							<AccountCardWidget
								address={currentAccount?.address ?? ''}
								balance={currentAccountInfo?.balance ?? '0'}
								name={currentAccount?.name ?? ''}
								price={walletController.modules.market.price}
								ticker={walletController.ticker}
								networkIdentifier={walletController.networkIdentifier}
								onNameChange={renameManager.call}
								onSwapPress={Router.goToBridgeSwap}
								onSendPress={Router.goToSend}
								onDetailsPress={Router.goToAccountDetails}
							/>
						</Animated.View>
						{historyWidget.isVisible && (
							<Animated.View entering={FadeInDown.delay(125)} exiting={FadeOutUp}>
								<HistoryWidget {...historyWidget.props} />
							</Animated.View>
						)}
					</Stack>
				</Spacer>
			</Screen.Upper>
		</Screen>
	);
};
