import { Header } from '@/app/app/components';
import { Screen, Spacer, Stack, StyledText } from '@/app/components';
import { useInit, useWalletController } from '@/app/hooks';
import { useAsyncManager } from '@/app/hooks/useAsyncManager';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { useAddressBookWidget } from '@/app/screens/address-book/hooks';
import { AddressBookWidget } from '@/app/screens/address-book/widgets/AddressBookWidget';
import { useHarvestingWidget } from '@/app/screens/harvesting/hooks';
import { HarvestingWidget } from '@/app/screens/harvesting/widgets';
import { useHistoryWidget } from '@/app/screens/history/hooks';
import { HistoryWidget } from '@/app/screens/history/widgets/HistoryWidget';
import { AccountCardWidget } from '@/app/screens/home/components/AccountCardWidget';
import { WidgetAnimatedWrapper } from '@/app/screens/home/components/WidgetAnimatedWrapper';
import { useMultisigWidget } from '@/app/screens/multisig/hooks/useMultisigWidget';
import { MultisigWidget } from '@/app/screens/multisig/widgets/MultisigWidget';
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
	const addressBookWidget = useAddressBookWidget(walletController);
	const multisigWidget = useMultisigWidget(walletController);
	const harvestingWidget = useHarvestingWidget(walletController);

	// Data fetching
	const fetchData = () => {
		walletController.fetchAccountInfo();
		historyWidget.refresh();
		multisigWidget.refresh();
		harvestingWidget.refresh();
	};

	useInit(fetchData, walletController.isWalletReady);

	const isUpdatesWidgetsVisible = historyWidget.isVisible;

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
								onNameChange={renameManager.call}
								onSwapPress={Router.goToBridgeSwap}
								onSendPress={Router.goToSend}
								onDetailsPress={Router.goToAccountDetails}
							/>
						</Animated.View>

						{isUpdatesWidgetsVisible && (
							<Stack gap="m">
								<StyledText type="title">
									{$t('s_home_updates')}
								</StyledText>
								<WidgetAnimatedWrapper isVisible={historyWidget.isVisible}>
									<HistoryWidget {...historyWidget.props} />
								</WidgetAnimatedWrapper>
							</Stack>
						)}

						<Stack gap="m">
							<WidgetAnimatedWrapper isVisible>
								<StyledText type="title">
									{$t('s_home_widgets')}
								</StyledText>
							</WidgetAnimatedWrapper>
							<WidgetAnimatedWrapper isVisible={addressBookWidget.isVisible}>
								<AddressBookWidget {...addressBookWidget.props} />
							</WidgetAnimatedWrapper>
							<WidgetAnimatedWrapper isVisible={multisigWidget.isVisible}>
								<MultisigWidget {...multisigWidget.props} />
							</WidgetAnimatedWrapper>
							<WidgetAnimatedWrapper isVisible={harvestingWidget.isVisible}>
								<HarvestingWidget {...harvestingWidget.props} />
							</WidgetAnimatedWrapper>
						</Stack>
					</Stack>
				</Spacer>
			</Screen.Upper>
		</Screen>
	);
};
