import { SettingsNetwork } from '@/app/screens/settings/SettingsNetwork';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockOs, mockWalletController } from '__tests__/mock-helpers';

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

const SCREEN_TEXT = {
	textNetworkSelectTitle: 's_settings_network_select_title',
	textNetworkTypeModalTitle: 's_settings_networkType_modal_title',
	textNodeSelectTitle: 's_settings_node_select_title',
	textNodeInfoTitle: 's_settings_node_info_title',
	textFieldNetwork: 'fieldTitle_network',
	textFieldNodeUrl: 'fieldTitle_nodeUrl',
	textFieldChainHeight: 'fieldTitle_chainHeight',
	textFieldMinFeeMultiplier: 'fieldTitle_minFeeMultiplier',
	buttonNetworkMainnet: 's_settings_networkType_mainnet',
	buttonNetworkTestnet: 's_settings_networkType_testnet',
	buttonNodeAutomatically: 's_settings_node_automatically'
};

const NETWORK_PROPERTIES_TESTNET_LOADED = NetworkPropertiesFixtureBuilder
	.createWithType('symbol', 'testnet')
	.build();
const NETWORK_PROPERTIES_EMPTY = NetworkPropertiesFixtureBuilder
	.createEmpty()
	.build();

const NODE_URLS = [
	'https://node1.symbol.com:3000',
	'https://node2.symbol.com:3000'
];

const createPendingPromise = () => new Promise(() => {});

const mockWalletControllerConfigured = (overrides = {}) => {
	return mockWalletController({
		selectNetwork: jest.fn().mockResolvedValue(undefined),
		networkApi: {
			network: {
				fetchNodeList: jest.fn().mockImplementation(createPendingPromise)
			}
		},
		...overrides
	});
};

describe('screens/settings/SettingsNetwork', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockLocalization();
		mockOs('android');
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders network selection dropdowns and info table', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const expectedTexts = [
				SCREEN_TEXT.textNetworkSelectTitle,
				SCREEN_TEXT.textNetworkTypeModalTitle,
				SCREEN_TEXT.textNodeSelectTitle,
				SCREEN_TEXT.textNodeInfoTitle
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
					mockWalletControllerConfigured({ networkProperties: config.networkProperties });

					// Act:
					const screenTester = new ScreenTester(SettingsNetwork);

					// Assert:
					screenTester.expectText(expected.textsToRender, true);
				});
			};

			const networkInfoTableTests = [
				{
					description: 'displays network properties correctly',
					config: {
						networkProperties: NETWORK_PROPERTIES_TESTNET_LOADED
					},
					expected: {
						textsToRender: [
							SCREEN_TEXT.textFieldNetwork,
							NETWORK_PROPERTIES_TESTNET_LOADED.networkIdentifier,
							SCREEN_TEXT.textFieldNodeUrl,
							NETWORK_PROPERTIES_TESTNET_LOADED.nodeUrl,
							SCREEN_TEXT.textFieldChainHeight,
							NETWORK_PROPERTIES_TESTNET_LOADED.chainHeight.toString(),
							SCREEN_TEXT.textFieldMinFeeMultiplier,
							NETWORK_PROPERTIES_TESTNET_LOADED.transactionFees.minFeeMultiplier.toString()
						]
					}
				},
				{
					description: 'displays "-" for null network properties',
					config: {
						networkProperties: NETWORK_PROPERTIES_EMPTY
					},
					expected: {
						textsToRender: [
							SCREEN_TEXT.textFieldNetwork,
							SCREEN_TEXT.textFieldNodeUrl,
							SCREEN_TEXT.textFieldChainHeight,
							SCREEN_TEXT.textFieldMinFeeMultiplier,
							'-'
						]
					}
				}
			];

			networkInfoTableTests.forEach(test => {
				runNetworkInfoTableTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('network dropdown', () => {
		it('shows mainnet and testnet options when dropdown is opened', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const screenTester = new ScreenTester(SettingsNetwork);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonNetworkTestnet);

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.buttonNetworkMainnet,
				SCREEN_TEXT.buttonNetworkTestnet
			], true);
		});
	});

	describe('network & node selection', () => {
		it('shows automatic node option', () => {
			// Arrange:
			mockWalletControllerConfigured({
				selectedNodeUrl: null
			});

			// Act:
			const screenTester = new ScreenTester(SettingsNetwork);

			// Assert:
			screenTester.expectText([SCREEN_TEXT.buttonNodeAutomatically]);
		});

		it('fetches node list on mount', async () => {
			// Arrange:
			const fetchNodeListMock = jest.fn().mockResolvedValue(NODE_URLS);
			mockWalletControllerConfigured({
				networkApi: {
					network: {
						fetchNodeList: fetchNodeListMock
					}
				}
			});

			// Act:
			const screenTester = new ScreenTester(SettingsNetwork);
			await screenTester.waitForTimer();

			// Assert:
			expect(fetchNodeListMock).toHaveBeenCalledWith('testnet');
		});

		it('calls selectNetwork when network is changed', async () => {
			// Arrange:
			const selectNetworkMock = jest.fn().mockResolvedValue(undefined);
			mockWalletControllerConfigured({
				selectNetwork: selectNetworkMock
			});
			const screenTester = new ScreenTester(SettingsNetwork);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonNetworkTestnet);
			screenTester.pressButton(SCREEN_TEXT.buttonNetworkMainnet);
			await screenTester.waitForTimer();

			// Assert:
			expect(selectNetworkMock).toHaveBeenCalledWith('mainnet', null);
		});
	});

	describe('loading state', () => {
		const runLoadingStateTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockWalletControllerConfigured({
					isNetworkConnectionReady: config.isNetworkConnectionReady
				});

				// Act:
				const screenTester = new ScreenTester(SettingsNetwork);

				// Assert:
				if (expected.isLoadingSpinnerVisible)
					screenTester.expectElement('loading-indicator');
				else
					screenTester.notExpectElement('loading-indicator');
			});
		};

		const loadingStateTests = [
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

		loadingStateTests.forEach(test => {
			runLoadingStateTest(test.description, test.config, test.expected);
		});
	});
});
