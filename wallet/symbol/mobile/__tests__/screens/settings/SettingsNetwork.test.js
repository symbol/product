import { SettingsNetwork } from '@/app/screens/settings/SettingsNetwork';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockOs, mockWalletController } from '__tests__/mock-helpers';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('@/app/config', () => {
	const original = jest.requireActual('@/app/config');
	return {
		...original,
		config: {
			...original.config,
			networkIdentifiers: ['mainnet', 'testnet']
		}
	};
});

describe('screens/settings/SettingsNetwork', () => {
	const createMockNetworkProperties = (overrides = {}) => ({
		networkIdentifier: 'mainnet',
		nodeUrl: 'https://symbol-node.example.com:3000',
		chainHeight: 1234567,
		transactionFees: {
			minFeeMultiplier: 100
		},
		...overrides
	});

	const createMockWalletController = (overrides = {}) => ({
		networkProperties: createMockNetworkProperties(overrides.networkProperties),
		networkIdentifier: overrides.networkIdentifier ?? 'mainnet',
		selectedNodeUrl: overrides.selectedNodeUrl ?? null,
		isNetworkConnectionReady: overrides.isNetworkConnectionReady ?? true,
		selectNetwork: jest.fn().mockResolvedValue(undefined),
		networkApi: {
			network: {
				fetchNodeList: jest.fn().mockResolvedValue([
					'https://node1.symbol.com:3000',
					'https://node2.symbol.com:3000'
				])
			}
		},
		...overrides
	});

	beforeEach(() => {
		mockLocalization();
		mockOs('android');
		jest.clearAllMocks();
	});

	describe('render', () => {
		it('renders network selection dropdowns and info table', () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			const expectedTexts = [
				's_settings_network_select_title',
				's_settings_networkType_modal_title',
				's_settings_node_select_title',
				's_settings_node_info_title'
			];

			// Act:
			const screenTester = new ScreenTester(SettingsNetwork);

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		describe('network info table', () => {
			const runNetworkInfoTableTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					mockWalletController(createMockWalletController(config.walletController));

					// Act:
					const { getByText, getAllByText } = render(<SettingsNetwork />);

					// Assert:
					expected.textsToRender.forEach(text => {
						if (text === '-')
							expect(getAllByText(text).length).toBeGreaterThanOrEqual(1);
						else
							expect(getByText(text)).toBeTruthy();
					});
				});
			};

			const tests = [
				{
					description: 'displays network properties correctly',
					config: {
						walletController: {
							networkProperties: {
								networkIdentifier: 'mainnet',
								nodeUrl: 'https://node.symbol.com:3000',
								chainHeight: 9876543,
								transactionFees: { minFeeMultiplier: 250 }
							}
						}
					},
					expected: {
						textsToRender: [
							'fieldTitle_network',
							'mainnet',
							'fieldTitle_nodeUrl',
							'https://node.symbol.com:3000',
							'fieldTitle_chainHeight',
							'9876543',
							'fieldTitle_minFeeMultiplier',
							'250'
						]
					}
				},
				{
					description: 'displays "-" for null network properties',
					config: {
						walletController: {
							networkProperties: {
								networkIdentifier: null,
								nodeUrl: null,
								chainHeight: null,
								transactionFees: { minFeeMultiplier: null }
							}
						}
					},
					expected: {
						textsToRender: [
							'fieldTitle_network',
							'fieldTitle_nodeUrl',
							'fieldTitle_chainHeight',
							'fieldTitle_minFeeMultiplier',
							'-'
						]
					}
				}
			];

			tests.forEach(test => {
				runNetworkInfoTableTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('network dropdown options', () => {
		it('shows mainnet and testnet options in network dropdown', async () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			const screenTester = new ScreenTester(SettingsNetwork);
			const expectedDropdownItems = [
				's_settings_networkType_mainnet',
				's_settings_networkType_testnet'
			];

			// Act:
			screenTester.pressButton('s_settings_networkType_mainnet');

			// Assert:
			screenTester.expectText(expectedDropdownItems, true);
		});
	});

	describe('node selection', () => {
		it('shows automatic node option', () => {
			// Arrange:
			mockWalletController(createMockWalletController());

			// Act:
			const screenTester = new ScreenTester(SettingsNetwork);

			// Assert:
			screenTester.expectText(['s_settings_node_automatically']);
		});

		it('fetches node list on mount', async () => {
			// Arrange:
			const fetchNodeListMock = jest.fn().mockResolvedValue([
				'https://node1.symbol.com:3000',
				'https://node2.symbol.com:3000'
			]);
			mockWalletController(createMockWalletController({
				networkApi: {
					network: {
						fetchNodeList: fetchNodeListMock
					}
				}
			}));

			// Act:
			render(<SettingsNetwork />);

			// Assert:
			await waitFor(() => {
				expect(fetchNodeListMock).toHaveBeenCalledWith('mainnet');
			});
		});
	});

	describe('network selection', () => {
		it('calls selectNetwork when network is changed', async () => {
			// Arrange:
			const selectNetworkMock = jest.fn().mockResolvedValue(undefined);
			mockWalletController(createMockWalletController({
				selectNetwork: selectNetworkMock
			}));
			const screenTester = new ScreenTester(SettingsNetwork);

			// Act:
			screenTester.pressButton('s_settings_networkType_mainnet');
			screenTester.pressButton('s_settings_networkType_testnet');
			await screenTester.waitForTimer();

			// Assert:
			expect(selectNetworkMock).toHaveBeenCalledWith('testnet', null);
		});
	});

	describe('loading state', () => {
		const runLoadingStateTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockWalletController(createMockWalletController({
					isNetworkConnectionReady: config.isNetworkConnectionReady
				}));
				const screenTester = new ScreenTester(SettingsNetwork);

				// Assert:
				if (expected.isLoadingSpinnerVisible)
					screenTester.expectElement('loading-indicator');
				else 
					screenTester.notExpectElement('loading-indicator');
			});
		};

		const tests = [
			{
				description: 'shows loading state when connecting to node',
				config: { isNetworkConnectionReady: false },
				expected: { isLoadingSpinnerVisible: true }
			},
			{
				description: 'hides loading state when connected to node',
				config: { isNetworkConnectionReady: true },
				expected: { isLoadingSpinnerVisible: false }
			}
		];

		tests.forEach(test => {
			runLoadingStateTest(test.description, test.config, test.expected);
		});
	});
});
