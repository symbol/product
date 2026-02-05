import { Router } from '@/app/Router';
import { Screen, Spacer, Stack } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { useAsyncManager } from '@/app/hooks/useAsyncManager';
import { AccountCardWidget } from '@/app/screens/home/components/AccountCardWidget';
import React from 'react';

/**
 * Home screen component. The main dashboard screen displaying the current account's balance, name,
 * and providing navigation to send transaction, view account details, and receive QR-code screens.
 */
export const Home = () => {
	const walletController = useWalletController();
	const { currentAccount, currentAccountInfo, networkIdentifier } = walletController;

	const renameManager = useAsyncManager({
		callback: async name => walletController.renameAccount({
			publicKey: currentAccount.publicKey,
			name,
			networkIdentifier
		})
	});
	const fetchData = async () => {
		await walletController.fetchAccountInfo();
	};

	return (
		<Screen
			refresh={{
				onRefresh: fetchData
			}}
		>
			<Screen.Upper>
				<Spacer>
					<Stack>
						<AccountCardWidget
							address={currentAccount?.address ?? ''}
							balance={currentAccountInfo?.balance ?? '0'}
							name={currentAccount?.name ?? ''}
							price={walletController.modules.market.price}
							networkIdentifier={walletController.networkIdentifier}
							onNameChange={renameManager.call}
							onReceivePress={Router.goToSettings}
							onSendPress={Router.goToSend}
							onDetailsPress={Router.goToAccountDetails}
						/>
					</Stack>
				</Spacer>
			</Screen.Upper>
		</Screen >
	);
};
