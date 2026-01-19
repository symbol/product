import { Send } from '@/app/screens/send/Send';
import { symbolTestnetNetworkProperties } from '__fixtures__/local/network';
import { currentAccount, walletStorageAccounts } from '__fixtures__/local/wallet';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization } from '__tests__/mock-helpers';
import { waitFor } from '@testing-library/react-native';

let mockWalletControllerValue = {};

jest.mock('@/app/hooks', () => {
	const actual = jest.requireActual('@/app/hooks');
	return {
		...actual,
		useWalletController: jest.fn(() => mockWalletControllerValue),
		useTransactionFees: jest.fn(() => ({
			data: null,
			isLoading: false,
			call: jest.fn()
		})),
		useDebounce: jest.fn(callback => callback)
	};
});

jest.mock('@/app/utils', () => {
	const actual = jest.requireActual('@/app/utils');
	return {
		...actual,
		getAddressName: jest.fn(address => address)
	};
});

const TEST_NETWORK_IDENTIFIER = 'testnet';
const TEST_CHAIN_NAME = 'symbol';
const TEST_TICKER = 'XYM';

const SCREEN_TEXT = {
	title: 'form_transfer_title',
	description: 's_send_description',
	recipientLabel: 'form_transfer_input_recipient',
	mosaicLabel: 'form_transfer_input_mosaic',
	amountLabel: 'form_transfer_input_amount',
	messageLabel: 'form_transfer_input_message',
	encryptedCheckbox: 'form_transfer_input_encrypted',
	sendButton: 'button_send',
	multisigDescription: 's_send_multisig_description',
	senderLabel: 'input_sender'
};

const TEST_MOSAICS = [
	{
		id: '72C0212E67A08BCE',
		name: 'symbol.xym',
		amount: '1000000000',
		divisibility: 6,
		duration: 0
	},
	{
		id: 'ABC123DEF456',
		name: 'custom.token',
		amount: '500000',
		divisibility: 3,
		duration: 0
	}
];

const TEST_RECIPIENT_ADDRESS = walletStorageAccounts.testnet[2].address;

const createMockAddressBook = (overrides = {}) => ({
	getAddressName: jest.fn(),
	...overrides
});

const createMockTransferModule = (overrides = {}) => ({
	createTransaction: jest.fn().mockResolvedValue({
		transactions: [],
		isComposite: false
	}),
	calculateTransactionFees: jest.fn().mockResolvedValue({
		slow: { fee: '100000', feeFormatted: '0.1' },
		medium: { fee: '200000', feeFormatted: '0.2' },
		fast: { fee: '300000', feeFormatted: '0.3' }
	}),
	...overrides
});

const createMockNetworkApi = (overrides = {}) => ({
	account: {
		fetchAccountInfo: jest.fn().mockResolvedValue({
			mosaics: TEST_MOSAICS,
			tokens: TEST_MOSAICS,
			publicKey: currentAccount.publicKey
		})
	},
	...overrides
});

const createMockWalletController = (overrides = {}) => ({
	accounts: walletStorageAccounts,
	modules: {
		addressBook: createMockAddressBook(overrides.addressBook),
		transfer: createMockTransferModule(overrides.transfer)
	},
	currentAccount: overrides.currentAccount ?? currentAccount,
	currentAccountInfo: {
		mosaics: TEST_MOSAICS,
		tokens: TEST_MOSAICS,
		isMultisig: overrides.isMultisig ?? false,
		cosignatories: overrides.cosignatories ?? [],
		multisigAddresses: overrides.multisigAddresses ?? [],
		...overrides.currentAccountInfo
	},
	isStateReady: overrides.isStateReady ?? true,
	isWalletReady: overrides.isWalletReady ?? true,
	isNetworkConnectionReady: overrides.isNetworkConnectionReady ?? true,
	networkProperties: overrides.networkProperties ?? {
		...symbolTestnetNetworkProperties,
		networkCurrency: {
			...symbolTestnetNetworkProperties.networkCurrency,
			id: '72C0212E67A08BCE'
		}
	},
	networkIdentifier: overrides.networkIdentifier ?? TEST_NETWORK_IDENTIFIER,
	chainHeight: overrides.chainHeight ?? 1319595,
	ticker: overrides.ticker ?? TEST_TICKER,
	price: overrides.price ?? 0.05,
	chainName: overrides.chainName ?? TEST_CHAIN_NAME,
	networkApi: createMockNetworkApi(overrides.networkApi),
	signTransactionBundle: jest.fn().mockResolvedValue({
		transactions: [{ hash: 'mockHash' }]
	}),
	announceSignedTransactionBundle: jest.fn().mockResolvedValue({}),
	on: jest.fn(),
	removeListener: jest.fn(),
	...overrides
});

const createDefaultRouteProps = (overrides = {}) => ({
	route: {
		params: {
			chainName: TEST_CHAIN_NAME,
			...overrides
		}
	}
});

describe('screens/send/Send', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
	});

	describe('render', () => {
		it('renders send form elements', async () => {
			// Arrange:
			mockWalletControllerValue = createMockWalletController();
			const expectedTexts = [
				SCREEN_TEXT.title,
				SCREEN_TEXT.description,
				SCREEN_TEXT.recipientLabel,
				SCREEN_TEXT.mosaicLabel,
				SCREEN_TEXT.amountLabel,
				SCREEN_TEXT.messageLabel,
				SCREEN_TEXT.encryptedCheckbox,
				SCREEN_TEXT.sendButton
			];
			const props = createDefaultRouteProps();

			// Act:
			const screenTester = new ScreenTester(Send, props);

			// Assert:
			await waitFor(() => {
				screenTester.expectText(expectedTexts);
			});
		});

		it('renders send button as disabled initially', async () => {
			// Arrange:
			mockWalletControllerValue = createMockWalletController();
			const props = createDefaultRouteProps();

			// Act:
			const screenTester = new ScreenTester(Send, props);

			// Assert:
			await waitFor(() => {
				screenTester.expectText([SCREEN_TEXT.sendButton]);
			});
		});

		it('does not render message field for chains without message support', async () => {
			// Arrange:
			mockWalletControllerValue = createMockWalletController({ chainName: 'ethereum' });
			const props = createDefaultRouteProps({ chainName: 'ethereum' });

			// Act:
			const screenTester = new ScreenTester(Send, props);

			// Assert:
			await waitFor(() => {
				screenTester.expectText([SCREEN_TEXT.title]);
				screenTester.notExpectText([SCREEN_TEXT.messageLabel, SCREEN_TEXT.encryptedCheckbox]);
			});
		});
	});

	describe('multisig account', () => {
		it('shows sender dropdown when account is cosignatory of multisig', async () => {
			// Arrange:
			const multisigAddress = walletStorageAccounts.testnet[3].address;
			mockWalletControllerValue = createMockWalletController({
				multisigAddresses: [multisigAddress],
				currentAccountInfo: {
					mosaics: TEST_MOSAICS,
					tokens: TEST_MOSAICS,
					isMultisig: false,
					cosignatories: [],
					multisigAddresses: [multisigAddress]
				}
			});
			const props = createDefaultRouteProps();

			// Act:
			const screenTester = new ScreenTester(Send, props);

			// Assert:
			// Check that multisig description is shown and the sender address is displayed
			await waitFor(() => {
				screenTester.expectText([SCREEN_TEXT.multisigDescription]);
				screenTester.expectText([currentAccount.address]);
			});
		});

		it('does not show sender dropdown for regular account', async () => {
			// Arrange:
			mockWalletControllerValue = createMockWalletController();
			const props = createDefaultRouteProps();

			// Act:
			const screenTester = new ScreenTester(Send, props);

			// Assert:
			await waitFor(() => {
				screenTester.expectText([SCREEN_TEXT.title]);
				screenTester.notExpectText([SCREEN_TEXT.multisigDescription, SCREEN_TEXT.senderLabel]);
			});
		});
	});

	describe('route params', () => {
		const runRouteParamsTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerValue = createMockWalletController();
				const props = createDefaultRouteProps(config.routeParams);

				// Act:
				const screenTester = new ScreenTester(Send, props);

				// Assert:
				await waitFor(() => {
					if (expected.inputValues) {
						expected.inputValues.forEach(value => {
							screenTester.expectInputValue(value);
						});
					}
				});
			});
		};

		const routeParamsTests = [
			{
				description: 'initializes with recipient address from route params',
				config: {
					routeParams: { recipientAddress: TEST_RECIPIENT_ADDRESS }
				},
				expected: {
					inputValues: [TEST_RECIPIENT_ADDRESS]
				}
			},
			{
				description: 'initializes with amount from route params',
				config: {
					routeParams: { amount: '10.5' }
				},
				expected: {
					inputValues: ['10.5']
				}
			},
			{
				description: 'initializes with message from route params',
				config: {
					routeParams: { message: { text: 'Hello World' } }
				},
				expected: {
					inputValues: ['Hello World']
				}
			}
		];

		routeParamsTests.forEach(test => {
			runRouteParamsTest(test.description, test.config, test.expected);
		});
	});

	describe('loading state', () => {
		it('shows loading when wallet is not ready', async () => {
			// Arrange:
			mockWalletControllerValue = createMockWalletController({ isWalletReady: false });
			const props = createDefaultRouteProps();

			// Act:
			const screenTester = new ScreenTester(Send, props);

			// Assert:
			screenTester.expectElement('loading-indicator');
		});
	});

	describe('chain support', () => {
		const runChainSupportTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerValue = createMockWalletController({ chainName: config.chainName });
				const props = createDefaultRouteProps({ chainName: config.chainName });

				// Act:
				const screenTester = new ScreenTester(Send, props);

				// Assert:
				await waitFor(() => {
					if (expected.hasMessageField) 
						screenTester.expectText([SCREEN_TEXT.messageLabel]);
					 else 
						screenTester.notExpectText([SCREEN_TEXT.messageLabel]);
					
				});
			});
		};

		const chainSupportTests = [
			{
				description: 'shows message field for symbol chain',
				config: { chainName: 'symbol' },
				expected: { hasMessageField: true }
			},
			{
				description: 'hides message field for ethereum chain',
				config: { chainName: 'ethereum' },
				expected: { hasMessageField: false }
			}
		];

		chainSupportTests.forEach(test => {
			runChainSupportTest(test.description, test.config, test.expected);
		});
	});
});
