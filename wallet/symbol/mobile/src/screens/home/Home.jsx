import { Button, Screen, Spacer, Stack, StyledText } from '@/app/components';
import { useAsyncManager } from '@/app/hooks/useAsyncManager';
import { walletControllers } from '@/app/lib/controller';
import { passcodeManager } from '@/app/lib/passcode';
import { $t } from '@/app/localization';
import React from 'react';

export const Home = () => {
	const logoutManager = useAsyncManager({
		callback: async () => {
			await walletControllers.main.clear();
			await Promise.all(walletControllers.additional.map(controller => controller.clear()));
			await passcodeManager.clear();
		}
	});

	return (
		<Screen>
			<Screen.Upper>
				<Spacer>
					<Stack>
						<StyledText type="title">
							Home
						</StyledText>
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
