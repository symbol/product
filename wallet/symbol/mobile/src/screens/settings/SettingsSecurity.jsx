import { Router } from '@/app/Router';
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
	const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
	const [mnemonic, setMnemonic] = useState('');
	const [isMnemonicShown, setIsMnemonicShown] = useState(false);

	const loadDataManager = useAsyncManager({
		callback: async () => {
			const isPasscodeEnabled = await passcodeManager.isPasscodeSet();
			const mnemonic = await walletController.getMnemonic();

			setIsPasscodeEnabled(isPasscodeEnabled);
			setMnemonic(mnemonic);
		}
	});
	const togglePasscodeManager = useAsyncManager({
		callback: async () => {
			if (isPasscodeEnabled)
				await passcodeManager.clear();

			loadDataManager.call();
			Router.goBack();
		}
	});

	const passcodeAction = isPasscodeEnabled ? 'verify' : 'create';
	const enablePasscode = usePasscode({ onSuccess: togglePasscodeManager.call }, passcodeAction);

	const showMnemonic = () => {
		setIsMnemonicShown(true);
	};
	const showMnemonicPasscode = usePasscode({ onSuccess: showMnemonic }, 'verify');

	const handlePasscodeToggle = () => {
		enablePasscode.show();
	};

	const handleShowMnemonicPress = () => {
		showMnemonicPasscode.show();
	};

	useEffect(() => {
		loadDataManager.call();
	}, []);

	const isLoading = loadDataManager.isLoading || togglePasscodeManager.isLoading;

	return (
		<Screen isLoading={isLoading}>
			<Screen.Upper>
				<Spacer>
					<Stack>
						<StyledText type="title">{$t('settings_security_pin_title')}</StyledText>
						<StyledText type="body">{$t('settings_security_pin_body')}</StyledText>
						<Checkbox
							text={$t('settings_security_pin_toggle')}
							value={isPasscodeEnabled}
							onChange={handlePasscodeToggle}
						/>
						<StyledText type="title">{$t('settings_security_mnemonic_title')}</StyledText>
						<StyledText type="body">{$t('settings_security_mnemonic_body')}</StyledText>
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
