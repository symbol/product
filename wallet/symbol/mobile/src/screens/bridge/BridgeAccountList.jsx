import { BridgeAccountCard } from './components';
import { useBridgeAccounts } from './hooks';
import { Screen, Spacer, Stack, TouchableNative } from '@/app/components';
import { useAsyncManager } from '@/app/hooks';
import { Router } from '@/app/router/Router';
import { generateFromMnemonic } from '@/app/screens/bridge/utils';
import React from 'react';

/**
 * BridgeAccountList screen component. Displays a list of bridge accounts from additional
 * wallet controllers, allowing users to view account details and activate new accounts
 * by generating them from the main wallet's mnemonic.
 * @returns {React.ReactNode} BridgeAccountList component.
 */
export const BridgeAccountList = () => {
	const { accounts, refresh } = useBridgeAccounts();

	const openAccount = chainName => {
		Router.goToBridgeAccountDetails({ params: { chainName } });
	};
	const activationManager = useAsyncManager({
		callback: async chainName => {
			await generateFromMnemonic(chainName);
			refresh();
		}
	});

	return (
		<Screen refresh={{ onRefresh: refresh }} isLoading={activationManager.isLoading}>
			<Spacer>
				<Stack>
					{accounts.map(({ chainName, ticker, account, balance, isActive }) => (
						<TouchableNative
							key={chainName}
							isDisabled={!isActive}
							onPress={() => openAccount(chainName)}
						>
							<BridgeAccountCard
								address={account?.address}
								name={chainName}
								account={account}
								balance={balance}
								ticker={ticker}
								isActive={isActive}
								onActivate={() => activationManager.call(chainName)}
							/>
						</TouchableNative>
					))}
				</Stack>
			</Spacer>
		</Screen>
	);
};
