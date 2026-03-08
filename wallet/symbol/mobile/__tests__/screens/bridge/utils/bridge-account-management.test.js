import {
	generateFromMnemonic,
	importFromPrivateKey,
	removeAccount
} from '@/app/screens/bridge/utils/bridge-account-management';
import { mnemonic } from '__fixtures__/local/wallet';
import { createWalletControllerMock } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME_ETHEREUM = 'ethereum';
const CHAIN_NAME_SYMBOL = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TEST_MNEMONIC = mnemonic;
const TEST_PRIVATE_KEY = '0x17bf8d4fadf6e9f0bffefaa94f13068bae2f9521176008baa4892ac8345a453b';

// Mock Configurations

const createMainWalletControllerMock = () => {
	return createWalletControllerMock({
		chainName: CHAIN_NAME_SYMBOL,
		networkIdentifier: NETWORK_IDENTIFIER,
		getMnemonic: jest.fn().mockResolvedValue(TEST_MNEMONIC)
	});
};

const createAdditionalWalletControllerMock = (chainName = CHAIN_NAME_ETHEREUM) => {
	return createWalletControllerMock({
		chainName,
		networkIdentifier: NETWORK_IDENTIFIER,
		saveMnemonicAndGenerateAccounts: jest.fn().mockResolvedValue(),
		addExternalAccount: jest.fn().mockResolvedValue(),
		clear: jest.fn().mockResolvedValue(),
		loadCache: jest.fn().mockResolvedValue(),
		selectNetwork: jest.fn().mockResolvedValue(),
		connectToNetwork: jest.fn().mockResolvedValue()
	});
};

// Mocks

const mockLoadWalletController = jest.fn().mockResolvedValue();

jest.mock('@/app/screens/bridge/utils/wallet-controller', () => ({
	loadWalletController: (...args) => mockLoadWalletController(...args)
}));

jest.mock('@/app/lib/controller', () => ({
	walletControllers: {
		main: null,
		additional: []
	}
}));

describe('screens/bridge/utils/bridge-account-management', () => {
	let walletControllersModule;
	let mainWalletController;
	let additionalWalletController;

	beforeEach(() => {
		jest.clearAllMocks();
		walletControllersModule = require('@/app/lib/controller');
		mainWalletController = createMainWalletControllerMock();
		additionalWalletController = createAdditionalWalletControllerMock();
		walletControllersModule.walletControllers.main = mainWalletController;
		walletControllersModule.walletControllers.additional = [additionalWalletController];
	});

	describe('generateFromMnemonic', () => {
		it('retrieves mnemonic from main wallet controller', async () => {
			// Act:
			await generateFromMnemonic(CHAIN_NAME_ETHEREUM);

			// Assert:
			expect(mainWalletController.getMnemonic).toHaveBeenCalledTimes(1);
		});

		it('saves mnemonic and generates accounts with correct parameters', async () => {
			// Act:
			await generateFromMnemonic(CHAIN_NAME_ETHEREUM);

			// Assert:
			expect(additionalWalletController.saveMnemonicAndGenerateAccounts).toHaveBeenCalledWith({
				mnemonic: TEST_MNEMONIC,
				name: CHAIN_NAME_ETHEREUM,
				accountPerNetworkCount: 1
			});
		});

		it('loads wallet controller after generating accounts', async () => {
			// Act:
			await generateFromMnemonic(CHAIN_NAME_ETHEREUM);

			// Assert:
			expect(mockLoadWalletController).toHaveBeenCalledWith(additionalWalletController);
		});

		it('executes operations in correct order', async () => {
			// Arrange:
			const callOrder = [];
			mainWalletController.getMnemonic.mockImplementation(() => {
				callOrder.push('getMnemonic');
				return Promise.resolve(TEST_MNEMONIC);
			});
			additionalWalletController.saveMnemonicAndGenerateAccounts.mockImplementation(() => {
				callOrder.push('saveMnemonicAndGenerateAccounts');
				return Promise.resolve();
			});
			mockLoadWalletController.mockImplementation(() => {
				callOrder.push('loadWalletController');
				return Promise.resolve();
			});

			// Act:
			await generateFromMnemonic(CHAIN_NAME_ETHEREUM);

			// Assert:
			expect(callOrder).toEqual([
				'getMnemonic',
				'saveMnemonicAndGenerateAccounts',
				'loadWalletController'
			]);
		});
	});

	describe('importFromPrivateKey', () => {
		it('adds external account with correct parameters', async () => {
			// Act:
			await importFromPrivateKey(CHAIN_NAME_ETHEREUM, TEST_PRIVATE_KEY);

			// Assert:
			expect(additionalWalletController.addExternalAccount).toHaveBeenCalledWith({
				privateKey: TEST_PRIVATE_KEY,
				name: CHAIN_NAME_ETHEREUM,
				networkIdentifier: NETWORK_IDENTIFIER
			});
		});

		it('loads wallet controller after adding external account', async () => {
			// Act:
			await importFromPrivateKey(CHAIN_NAME_ETHEREUM, TEST_PRIVATE_KEY);

			// Assert:
			expect(mockLoadWalletController).toHaveBeenCalledWith(additionalWalletController);
		});

		it('executes operations in correct order', async () => {
			// Arrange:
			const callOrder = [];
			additionalWalletController.addExternalAccount.mockImplementation(() => {
				callOrder.push('addExternalAccount');
				return Promise.resolve();
			});
			mockLoadWalletController.mockImplementation(() => {
				callOrder.push('loadWalletController');
				return Promise.resolve();
			});

			// Act:
			await importFromPrivateKey(CHAIN_NAME_ETHEREUM, TEST_PRIVATE_KEY);

			// Assert:
			expect(callOrder).toEqual([
				'addExternalAccount',
				'loadWalletController'
			]);
		});
	});

	describe('removeAccount', () => {
		it('clears wallet controller for specified chain', async () => {
			// Act:
			await removeAccount(CHAIN_NAME_ETHEREUM);

			// Assert:
			expect(additionalWalletController.clear).toHaveBeenCalledTimes(1);
		});

		it('does not load wallet controller after clearing', async () => {
			// Act:
			await removeAccount(CHAIN_NAME_ETHEREUM);

			// Assert:
			expect(mockLoadWalletController).not.toHaveBeenCalled();
		});
	});

	describe('wallet controller lookup', () => {
		it('finds correct wallet controller by chain name', async () => {
			// Arrange:
			const ethereumController = createAdditionalWalletControllerMock(CHAIN_NAME_ETHEREUM);
			const symbolController = createAdditionalWalletControllerMock(CHAIN_NAME_SYMBOL);
			walletControllersModule.walletControllers.additional = [
				ethereumController,
				symbolController
			];

			// Act:
			await generateFromMnemonic(CHAIN_NAME_ETHEREUM);

			// Assert:
			expect(ethereumController.saveMnemonicAndGenerateAccounts).toHaveBeenCalled();
			expect(symbolController.saveMnemonicAndGenerateAccounts).not.toHaveBeenCalled();
		});
	});
});
