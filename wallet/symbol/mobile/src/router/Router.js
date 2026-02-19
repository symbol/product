import { RouteName } from '@/app/router/config';
import { navigationRef } from '@/app/router/navigationRef';

const parseNavigationParams = params => {
	if (!params?.params)
		return {};

	return params.params;
};

export class Router {
	static goBack() {
		navigationRef.goBack();
	}
	static goToWelcome() {
		navigationRef.reset({
			index: 0,
			routes: [{ name: RouteName.Welcome }]
		});
	}
	static goToCreateWallet() {
		navigationRef.navigate(RouteName.CreateWallet);
	}
	static goToImportWallet() {
		navigationRef.navigate(RouteName.ImportWallet);
	}
	static goToHome() {
		navigationRef.reset({
			index: 0,
			routes: [{ name: RouteName.Home }]
		});
	}
	static goToHistory() {
		navigationRef.reset({
			index: 0,
			routes: [{ name: RouteName.History }]
		});
	}
	static goToAssets() {
		navigationRef.reset({
			index: 0,
			routes: [{ name: RouteName.Assets }]
		});
	}
	static goToAccountDetails(params) {
		navigationRef.navigate(RouteName.AccountDetails, parseNavigationParams(params));
	}
	static goToAccountList(params) {
		navigationRef.navigate(RouteName.AccountList, parseNavigationParams(params));
	}
	static goToAddSeedAccount(params) {
		navigationRef.navigate(RouteName.AddSeedAccount, parseNavigationParams(params));
	}
	static goToAddExternalAccount(params) {
		navigationRef.navigate(RouteName.AddExternalAccount, parseNavigationParams(params));
	}
	static goToSend(params) {
		navigationRef.navigate(RouteName.Send, parseNavigationParams(params));
	}
	static goToSettings(params) {
		navigationRef.navigate(RouteName.Settings, parseNavigationParams(params));
	}
	static goToSettingsAbout(params) {
		navigationRef.navigate(RouteName.SettingsAbout, parseNavigationParams(params));
	}
	static goToSettingsNetwork(params) {
		navigationRef.navigate(RouteName.SettingsNetwork, parseNavigationParams(params));
	}
	static goToSettingsSecurity(params) {
		navigationRef.navigate(RouteName.SettingsSecurity, parseNavigationParams(params));
	}
}
