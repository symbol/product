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
	static goToActions() {
		navigationRef.reset({
			index: 0,
			routes: [{ name: RouteName.Actions }]
		});
	}
	static goToTransactionDetails(params) {
		navigationRef.navigate(RouteName.TransactionDetails, parseNavigationParams(params));
	}
	static goToAssets() {
		navigationRef.reset({
			index: 0,
			routes: [{ name: RouteName.Assets }]
		});
	}
	static goToTokenDetails(params) {
		navigationRef.navigate(RouteName.TokenDetails, parseNavigationParams(params));
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
	static goToBridgeAccountList(params) {
		navigationRef.navigate(RouteName.BridgeAccountList, parseNavigationParams(params));
	}
	static goToBridgeAccountDetails(params) {
		navigationRef.navigate(RouteName.BridgeAccountDetails, parseNavigationParams(params));
	}
	static goToBridgeSwap(params) {
		navigationRef.navigate(RouteName.BridgeSwap, parseNavigationParams(params));
	}
	static goToBridgeSwapDetails(params) {
		navigationRef.navigate(RouteName.BridgeSwapDetails, parseNavigationParams(params));
	}
	static goToMultisigAccountList(params) {
		navigationRef.navigate(RouteName.MultisigAccountList, parseNavigationParams(params));
	}
	static goToMultisigAccountDetails(params) {
		navigationRef.navigate(RouteName.MultisigAccountDetails, parseNavigationParams(params));
	}
	static goToCreateMultisigAccount(params) {
		navigationRef.navigate(RouteName.CreateMultisigAccount, parseNavigationParams(params));
	}
	static goToModifyMultisigAccount(params) {
		navigationRef.navigate(RouteName.ModifyMultisigAccount, parseNavigationParams(params));
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
	static goToContactList(params) {
		navigationRef.navigate(RouteName.ContactList, parseNavigationParams(params));
	}
	static goToContactDetails(params) {
		navigationRef.navigate(RouteName.ContactDetails, parseNavigationParams(params));
	}
	static goToCreateContact(params) {
		navigationRef.navigate(RouteName.CreateContact, parseNavigationParams(params));
	}
	static goToEditContact(params) {
		navigationRef.navigate(RouteName.EditContact, parseNavigationParams(params));
	}
	static goToHarvesting(params) {
		navigationRef.navigate(RouteName.Harvesting, parseNavigationParams(params));
	}
}
