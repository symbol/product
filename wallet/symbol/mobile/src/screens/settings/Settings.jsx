import { SettingsItem } from './components/SettingsItem';
import { DialogBox, DropdownModal, PasscodeView, Screen, Spacer, Stack } from '@/app/components';
import { config } from '@/app/config';
import { usePasscode, useToggle, useWalletController } from '@/app/hooks';
import { walletControllers } from '@/app/lib/controller';
import { $t, getLanguages, initLocalization, setCurrentLanguage } from '@/app/localization';
import { Router } from '@/app/router/Router';
import React from 'react';

/**
 * Settings screen component. A screen providing access to application settings including network
 * configuration, language selection, security options, currency preferences, about information,
 * and logout functionality.
 */
export const Settings = () => {
	const walletController = useWalletController();
	const userCurrency = walletController.modules.market.price.currency;
	const userLanguage = walletController.modules.localization.currentLanguage;
	const [isLogoutConfirmVisible, toggleLogoutConfirm] = useToggle(false);
	const [isLanguageSelectorVisible, toggleLanguageSelector] = useToggle(false);
	const [isUserCurrencySelectorVisible, toggleUserCurrencySelector] = useToggle(false);
	const languageList = Object.entries(getLanguages()).map(([value, label]) => ({ value, label }));
	const currencyList = config.marketCurrencies.map(currency => ({ value: currency, label: currency }));
	const settingsList = [
		{
			title: $t('s_settings_item_network_title'),
			description: $t('s_settings_item_network_description'),
			icon: 'network',
			handler: Router.goToSettingsNetwork
		},
		{
			title: $t('s_settings_item_language_title'),
			description: $t('s_settings_item_language_description'),
			icon: 'language',
			handler: toggleLanguageSelector
		},
		{
			title: $t('s_settings_item_security_title'),
			description: $t('s_settings_item_security_description'),
			icon: 'security',
			handler: Router.goToSettingsSecurity
		},
		{
			title: $t('s_settings_item_currency_title'),
			description: $t('s_settings_item_currency_description'),
			icon: 'currency',
			handler: toggleUserCurrencySelector
		},
		{
			title: $t('s_settings_item_about_title'),
			description: $t('s_settings_item_about_description'),
			icon: 'about',
			handler: Router.goToSettingsAbout
		},
		{
			title: $t('s_settings_item_logout_title'),
			description: $t('s_settings_item_logout_description'),
			icon: 'logout',
			handler: toggleLogoutConfirm
		}
	];

	const changeLanguage = language => {
		setCurrentLanguage(language);
		Router.goToWelcome();
	};
	const changeUserCurrency = userCurrency => {
		walletController.modules.market.selectUserCurrency(userCurrency);
	};
	const logoutConfirm = async () => {
		walletControllers.main.clear();
		walletControllers.additional.forEach(controller => controller.clear());
		initLocalization();
	};
	const passcode = usePasscode({ onSuccess: logoutConfirm });
	const handleLogoutPress = () => {
		toggleLogoutConfirm();
		passcode.show();
	};

	return (
		<Screen>
			<Screen.Upper>
				<Spacer>
					<Stack gap="s">
						{settingsList.map((item, index) => (
							<SettingsItem
								key={item.title}
								title={item.title}
								description={item.description}
								icon={item.icon}
								index={index}
								onPress={item.handler}
							/>
						))}
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<DropdownModal
					title={$t('s_settings_item_language_title')}
					list={languageList}
					value={userLanguage}
					isOpen={isLanguageSelectorVisible}
					onChange={changeLanguage}
					onClose={toggleLanguageSelector}
				/>
				<DropdownModal
					title={$t('s_settings_item_currency_title')}
					list={currencyList}
					value={userCurrency}
					isOpen={isUserCurrencySelectorVisible}
					onChange={changeUserCurrency}
					onClose={toggleUserCurrencySelector}
				/>
				<DialogBox
					type="confirm"
					title={$t('settings_logout_confirm_title')}
					text={$t('settings_logout_confirm_text')}
					isVisible={isLogoutConfirmVisible}
					onSuccess={handleLogoutPress}
					onCancel={toggleLogoutConfirm}
				/>
				<PasscodeView {...passcode.props} />
			</Screen.Bottom>
		</Screen>
	);
};
