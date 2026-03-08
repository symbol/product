import { loadWalletController } from '@/app/screens/bridge/utils/wallet-controller';
import { createWalletControllerMock } from '__tests__/mock-helpers';

// Constants

const NETWORK_IDENTIFIER_MAINNET = 'mainnet';
const NETWORK_IDENTIFIER_TESTNET = 'testnet';

// Mock Configurations

const createMainWalletControllerMock = (networkIdentifier = NETWORK_IDENTIFIER_TESTNET) => {
	return createWalletControllerMock({
		networkIdentifier,
		getMnemonic: jest.fn().mockResolvedValue('mock mnemonic')
	});
};

const createAdditionalWalletControllerMock = (networkIdentifier = NETWORK_IDENTIFIER_TESTNET) => {
	return createWalletControllerMock({
		chainName: 'ethereum',
		networkIdentifier,
		loadCache: jest.fn().mockResolvedValue(),
		selectNetwork: jest.fn().mockResolvedValue(),
		connectToNetwork: jest.fn().mockResolvedValue()
	});
};

// Mocks

jest.mock('@/app/lib/controller', () => ({
	walletControllers: {
		main: null,
		additional: []
	}
}));

describe('screens/bridge/utils/wallet-controller', () => {
	let walletControllersModule;

	beforeEach(() => {
		jest.clearAllMocks();
		walletControllersModule = require('@/app/lib/controller');
	});

	describe('loadWalletController', () => {
		describe('network selection', () => {
			const runNetworkSelectionTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					const mainWalletController = createMainWalletControllerMock(config.mainNetworkIdentifier);
					const additionalWalletController = createAdditionalWalletControllerMock(config.additionalNetworkIdentifier);
					walletControllersModule.walletControllers.main = mainWalletController;

					// Act:
					await loadWalletController(additionalWalletController);

					// Assert:
					if (expected.shouldSelectNetwork) {
						expect(additionalWalletController.selectNetwork).toHaveBeenCalledTimes(1);
						expect(additionalWalletController.selectNetwork).toHaveBeenCalledWith(config.mainNetworkIdentifier);
					} else {
						expect(additionalWalletController.selectNetwork).not.toHaveBeenCalled();
					}
				});
			};

			const networkSelectionTests = [
				{
					description: 'selects network when network identifiers differ',
					config: {
						mainNetworkIdentifier: NETWORK_IDENTIFIER_TESTNET,
						additionalNetworkIdentifier: NETWORK_IDENTIFIER_MAINNET
					},
					expected: {
						shouldSelectNetwork: true
					}
				},
				{
					description: 'does not select network when network identifiers match',
					config: {
						mainNetworkIdentifier: NETWORK_IDENTIFIER_TESTNET,
						additionalNetworkIdentifier: NETWORK_IDENTIFIER_TESTNET
					},
					expected: {
						shouldSelectNetwork: false
					}
				}
			];

			networkSelectionTests.forEach(test => {
				runNetworkSelectionTest(test.description, test.config, test.expected);
			});
		});

		it('executes operations in correct order', async () => {
			// Arrange:
			const mainWalletController = createMainWalletControllerMock(NETWORK_IDENTIFIER_TESTNET);
			const additionalWalletController = createAdditionalWalletControllerMock(NETWORK_IDENTIFIER_MAINNET);
			walletControllersModule.walletControllers.main = mainWalletController;
			const callOrder = [];
			additionalWalletController.loadCache.mockImplementation(() => {
				callOrder.push('loadCache');
				return Promise.resolve();
			});
			additionalWalletController.selectNetwork.mockImplementation(() => {
				callOrder.push('selectNetwork');
				return Promise.resolve();
			});
			additionalWalletController.connectToNetwork.mockImplementation(() => {
				callOrder.push('connectToNetwork');
				return Promise.resolve();
			});

			// Act:
			await loadWalletController(additionalWalletController);

			// Assert:
			expect(callOrder).toEqual(['loadCache', 'selectNetwork', 'connectToNetwork']);
		});
	});
});
