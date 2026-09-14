import { Checkbox, MnemonicView, PasscodeView, Screen, Spacer, Stack, StyledText } from '@/app/components';
import { useAsyncManager, usePasscode, useWalletController } from '@/app/hooks';
import { passcodeManager } from '@/app/lib/passcode';
import { $t } from '@/app/localization';
import React, { useEffect, useState } from 'react';

/**
 * SettingsSecurity screen component. A screen for managing security settings, allowing users to
 * enable or disable passcode protection and reveal their mnemonic phrase with passcode verification.
 */
export const SettingsSecurity = () => {
	const walletController = useWalletController();
	const [isMnemonicShown, setIsMnemonicShown] = useState(false);

	// Passcode
	const loadPasscodeManager = useAsyncManager({
		callback: async () => await passcodeManager.isPasscodeSet(),
		defaultData: false
	});
	const isPasscodeEnabled = loadPasscodeManager.data;
	const togglePasscodeManager = useAsyncManager({
		callback: async () => {
			if (isPasscodeEnabled)
				await passcodeManager.clear();

			loadPasscodeManager.call();
		}
	});
	const passcodeAction = isPasscodeEnabled ? 'verify' : 'create';
	const enablePasscode = usePasscode({ onSuccess: togglePasscodeManager.call }, passcodeAction);
	const handlePasscodeToggle = () => {
		enablePasscode.show();
	};

	// Mnemonic
	const mnemonicManager = useAsyncManager({
		callback: async () => await walletController.getMnemonic(),
		defaultData: ''
	});
	const mnemonic = mnemonicManager.data;
	const showMnemonic = () => {
		mnemonicManager.call()
			.then(() => setIsMnemonicShown(true));
	};
	const showMnemonicPasscode = usePasscode({ onSuccess: showMnemonic }, 'verify');
	const handleShowMnemonicPress = () => {
		showMnemonicPasscode.show();
	};

	useEffect(() => {
		loadPasscodeManager.call();
	}, []);

	const isLoading = loadPasscodeManager.isLoading || togglePasscodeManager.isLoading;

	return (
		<Screen isLoading={isLoading}>
			<Screen.Upper>
				<Spacer>
					<Stack>
						<StyledText type="title">{$t('screen_settings_title_securityPin')}</StyledText>
						<StyledText type="body">{$t('screen_settings_description_securityPin')}</StyledText>
						<Checkbox
							text={$t('screen_settings_checkbox_enablePin')}
							value={isPasscodeEnabled}
							onChange={handlePasscodeToggle}
						/>
						<StyledText type="title">{$t('screen_settings_title_securityMnemonic')}</StyledText>
						<StyledText type="body">{$t('screen_settings_description_securityMnemonic')}</StyledText>
						<MnemonicView
							mnemonic={mnemonic}
							isShown={isMnemonicShown}
							onShowPress={handleShowMnemonicPress}
						/>
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<PasscodeView {...enablePasscode.props} />
				<PasscodeView {...showMnemonicPasscode.props} />
			</Screen.Bottom>
		</Screen>
	);
};
