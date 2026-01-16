import { Router } from '@/app/Router';
import { Button, Screen, Spacer, Stack } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { useAsyncManager } from '@/app/hooks/useAsyncManager';
import { walletControllers } from '@/app/lib/controller';
import { passcodeManager } from '@/app/lib/passcode';
import { $t } from '@/app/localization';
import { AccountCardWidget } from '@/app/screens/home/components/AccountCardWidget';
import React from 'react';

export const Home = () => {
	const walletController = useWalletController();
	const { currentAccount, currentAccountInfo, networkIdentifier } = walletController;

	const logoutManager = useAsyncManager({
		callback: async () => {
			await walletControllers.main.clear();
			await Promise.all(walletControllers.additional.map(controller => controller.clear()));
			await passcodeManager.clear();
		}
	});
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
			<Screen.Bottom>
				<Spacer>
					<Button
						variant="danger"
						text={$t('s_settings_item_logout_title')}
						onPress={logoutManager.call}
					/>
				</Spacer>
			</Screen.Bottom>
		</Screen >
	);
};
