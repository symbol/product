import { AddressBookListWidget } from './AddressBookList';
import { HistoryWidget } from './History';
import { Router } from '@/app/Router';
import { AccountCardWidget, Alert, FormItem, Screen, StyledText, TabNavigator, TitleBar } from '@/app/components';
import { ControllerEventName, TransactionGroup } from '@/app/constants';
import { useCurrentAccount, useCurrentAccountInfo, useDataManager, useInit, useLoading, useNetworkIdentifier, useNetworkProperties, useWalletController } from '@/app/hooks';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { $t } from '@/app/localization';
import { BridgeTokenList, BridgeWidget } from '@/app/screens/bridge/components/BridgeTokents';
import { useBridgeAccounts } from '@/app/screens/bridge/useBridgeAccounts';
import { colors } from '@/app/styles';
import { handleError } from '@/app/utils';
import React, { useCallback, useEffect, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeInUp, withDelay, withTiming } from 'react-native-reanimated';
import { constants } from 'wallet-common-core';

const CustomLayout = values => {
	'worklet';
	const isMovingUp = values.currentOriginY < values.targetOriginY;

	return {
		animations: {
			originY: isMovingUp
				? withTiming(values.targetOriginY, { duration: 300 })
				: withDelay(300, withTiming(values.targetOriginY, { duration: 300 }))
		},
		initialValues: {
			originY: values.currentOriginY
		}
	};
};

export const Home = () => {
	const WalletController = useWalletController();
	const { isWalletReady, currentAccount, currentAccountInfo, networkIdentifier, ticker, price } = WalletController;
	const bridgeAccounts = useBridgeAccounts(handleError);
	const defaultUnconfirmedTransactions = useMemo(() => [], []);
	const [fetchUnconfirmedTransactions, isUnconfirmedTransactionsLoading, unconfirmedTransactions] = useDataManager(
		async () => {
			return WalletController.fetchAccountTransactions({ group: TransactionGroup.UNCONFIRMED });
		},
		defaultUnconfirmedTransactions,
		handleError
	);
	const [fetchPartialTransactions, isPartialTransactionsLoading, partialTransactions] = useDataManager(
		async () => {
			return WalletController.fetchAccountTransactions({ group: TransactionGroup.PARTIAL });
		},
		defaultUnconfirmedTransactions,
		handleError
	);
	const [fetchAccountInfo, isAccountInfoLoading] = useDataManager(
		WalletController.fetchAccountInfo,
		null,
		handleError
	);
	const [renameAccount] = useDataManager(
		name =>
			WalletController.renameAccount({
				publicKey: currentAccount.publicKey,
				name,
				networkIdentifier
			}),
		null,
		handleError
	);
	const loadState = useCallback(() => {
		if (isWalletReady && currentAccount) {
			fetchAccountInfo();
			fetchUnconfirmedTransactions();
			fetchPartialTransactions();
		}
		bridgeAccounts.load();
	}, [currentAccount]);
	useInit(loadState, isWalletReady, [currentAccount]);

	useEffect(() => {
		WalletController.on(constants.ControllerEventName.NEW_TRANSACTION_UNCONFIRMED, loadState);
		WalletController.on(constants.ControllerEventName.NEW_TRANSACTION_PARTIAL, loadState);
		WalletController.on(constants.ControllerEventName.NEW_TRANSACTION_CONFIRMED, loadState);

		return () => {
			WalletController.removeListener(constants.ControllerEventName.NEW_TRANSACTION_UNCONFIRMED, loadState);
			WalletController.removeListener(constants.ControllerEventName.NEW_TRANSACTION_CONFIRMED, loadState);
			WalletController.removeListener(constants.ControllerEventName.NEW_TRANSACTION_PARTIAL, loadState);
		};
	}, []);

	const accountBalance = currentAccountInfo?.balance || 0;
	const accountName = currentAccount?.name || '-';
	const accountAddress = currentAccount?.address || '-';

	const [isLoading, isRefreshing] = useLoading(isUnconfirmedTransactionsLoading || isPartialTransactionsLoading || isAccountInfoLoading || bridgeAccounts.isLoading);

	return (
		<Screen
			titleBar={<TitleBar accountSelector settings isLoading={isLoading} currentAccount={currentAccount} />}
			navigator={<TabNavigator />}
		>
			<ScrollView refreshControl={<RefreshControl tintColor={colors.primary} refreshing={isRefreshing} onRefresh={loadState} />}>
				<Animated.View entering={FadeInUp}>
					<FormItem>
						<AccountCardWidget
							name={accountName}
							address={accountAddress}
							balance={accountBalance}
							ticker={ticker}
							price={price}
							networkIdentifier={networkIdentifier}
							onReceivePress={Router.goToReceive}
							onSendPress={Router.goToSend}
							onDetailsPress={Router.goToAccountDetails}
							onNameChange={renameAccount}
						/>
					</FormItem>
				</Animated.View>
				{currentAccountInfo?.isMultisig && (
					<Animated.View entering={FadeInUp}>
						<FormItem>
							<Alert type="warning" title={$t('warning_multisig_title')} body={$t('warning_multisig_body')} />
						</FormItem>
					</Animated.View>
				)}
				<FormItem type="group" clear="bottom">
					<StyledText type="title">{$t('s_home_widgets')}</StyledText>
				</FormItem>
				<HistoryWidget unconfirmed={unconfirmedTransactions} partial={partialTransactions} />
				<Animated.View entering={FadeInDown.delay(125)} layout={CustomLayout}>
					<AddressBookListWidget />
				</Animated.View>
				{bridgeAccounts.bridgeTokens.length > 0 && (
					<Animated.View entering={FadeInDown.delay(125)} layout={CustomLayout}>
						<BridgeWidget bridgeTokens={bridgeAccounts.bridgeTokens} />
					</Animated.View>
				)}
			</ScrollView>
		</Screen>
	);
};
