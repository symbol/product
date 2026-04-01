import * as hooks from '@/app/hooks';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import * as localization from '@/app/localization';
import { currentAccount, currentNetworkIdentifier, walletStorageAccounts } from '__fixtures__/local/wallet';
import { jest } from '@jest/globals';
import SplashScreen from 'react-native-splash-screen';

/**
 * Create a mock wallet controller object to simulate wallet controller behavior.
 *
 * @param {Object} overrides - An object to override specific methods of the wallet controller mock.
 * @param {Object} [options] - Mock options.
 * 
 * @return {import('wallet-common-core').WalletController} The mocked wallet controller.
 */
export const createWalletControllerMock = (overrides = {}) => {
	const walletControllerMock = {
		chainName: 'symbol',
		networkApi: {},
		ticker: 'XYM',
		hasAccounts: true,
		accounts: {
			...walletStorageAccounts.symbol
		},
		accountInfos: {
			mainnet: [],
			testnet: []
		},
		seedAddresses: [],
		currentAccount: currentAccount,
		currentAccountInfo: null,
		currentAccountLatestTransactions: [],
		networkIdentifier: currentNetworkIdentifier,
		networkProperties: {},
		selectedNodeUrl: 'https://node.net:3001',
		networkStatus: 'connected',
		isNetworkConnectionReady: true,
		isStateReady: true,
		isWalletReady: true,
		modules: {},

		loadCache: jest.fn(),
		selectAccount: jest.fn(),
		saveMnemonicAndGenerateAccounts: jest.fn(),
		addSeedAccount: jest.fn(),
		addExternalAccount: jest.fn(),
		renameAccount: jest.fn(),
		removeAccount: jest.fn(),
		changeAccountsOrder: jest.fn(),
		fetchAccountInfo: jest.fn(),
		fetchAccountTransactions: jest.fn(),
		fetchTransactionStatus: jest.fn(),
		getMnemonic: jest.fn(),
		getCurrentAccountPrivateKey: jest.fn(),
		signTransactionBundle: jest.fn(),
		signTransaction: jest.fn(),
		cosignTransaction: jest.fn(),
		announceSignedTransaction: jest.fn(),
		announceSignedTransactionBundle: jest.fn(),
		encryptMessage: jest.fn(),
		decryptMessage: jest.fn(),
		clear: jest.fn(),
		connectToNetwork: jest.fn(),
		selectNetwork: jest.fn(),
		resetState: jest.fn(),
		on: jest.fn(),
		removeListener: jest.fn(),
		...overrides
	};

	return walletControllerMock;
};

/**
 * Mocks the useWalletController hook to simulate wallet controller behavior.
 *
 * @param {Object} overrides - An object to override specific methods of the wallet controller mock.
 * @param {Object} [options] - Mock options.
 * 
 * @return {import('wallet-common-core').WalletController} The mocked wallet controller.
 */
export const mockWalletController = (overrides = {}) => {
	const walletControllerMock = createWalletControllerMock(overrides);
	jest.spyOn(hooks, 'useWalletController').mockReturnValue(walletControllerMock);

	return walletControllerMock;
};

/**
 * Mocks the usePasscode hook to simulate passcode behavior.
 */
export const mockPasscode = () => {
	jest.spyOn(hooks, 'usePasscode').mockImplementation(({ onSuccess }) => ({
		show: () => onSuccess(),
		props: {}
	}));
};

/**
 * Mocks methods of the Router module.
 * 
 * @param {Object} overrides - An object to override specific methods of the Router mock.
 * 
 * @return {Object} The mocked router navigation methods.
 */
export const mockRouter = (overrides = {}) => {
	const { Router} = require('@/app/router/Router');
	const routerNavigationMock = {
		goBack: jest.fn(),
		...overrides
	};
	Object.keys(routerNavigationMock).forEach(method => {
		jest.spyOn(Router, method).mockImplementation(routerNavigationMock[method]);
	});

	return routerNavigationMock;
};

/**
 * Mocks the localization $t function.
 * @param {Object|function(string, object): string} dictionaryOrCallback - Either a dictionary object mapping keys to translations 
 * or a callback function for custom translation logic.
 */
export const mockLocalization = dictionaryOrCallback => {
	const callback = typeof dictionaryOrCallback === 'function' ? dictionaryOrCallback : null;
	const dictionary = dictionaryOrCallback ?? {};

	if (callback) {
		jest.spyOn(localization, '$t').mockImplementation(callback);
	}
	else {
		jest.spyOn(localization, '$t').mockImplementation(key => {
			return dictionary[key] || key;
		});
	}
};

/**
 * Mocks the SplashScreen module.
 * 
 * @return {Object} The mocked SplashScreen.
 */
export const mockSplashScreen = () => {
	const splashScreenMock = {
		hide: jest.fn()
	};
	jest.spyOn(SplashScreen, 'hide').mockImplementation(splashScreenMock.hide);

	return splashScreenMock;
};

/**
 * Mocks the OS platform.
 * 
 * @param {string} platform - The platform to mock (e.g., 'ios', 'android').
 */
export const mockOs = platform => {
	jest.spyOn(PlatformUtils, 'getOS').mockReturnValue(platform);
};

/**
 * Mocks the link opening functionality.
 * 
 * @return {Function} The mocked openLink function.
 */
export const mockLink = () => {
	const openLinkMock = jest.fn();
	jest.spyOn(PlatformUtils, 'openLink').mockImplementation(openLinkMock);

	return openLinkMock;
};
