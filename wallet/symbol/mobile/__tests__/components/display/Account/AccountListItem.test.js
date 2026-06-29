import { AccountListItem } from '@/app/components/display/Account/AccountListItem';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization } from '__tests__/mock-helpers';
import { Text } from 'react-native';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';
const DEFAULT_NAME = 'Default Name';
const ACCESSORY_TEXT = 'accessory';

// Account Fixtures

const knownAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const unknownAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.build();

// Props

const createProps = (overrides = {}) => ({
	address: knownAccount.address,
	balance: '1000000000',
	ticker: TICKER,
	walletAccounts: [knownAccount],
	addressBook: { getAddressName: jest.fn(), getContactByAddress: jest.fn() },
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	...overrides
});

describe('components/display/Account/AccountListItem', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('name resolution', () => {
		const runNameTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const screenTester = new ScreenTester(AccountListItem, props);

				// Assert:
				screenTester.expectText([expected.name, props.address], true);
			});
		};

		const nameResolutionTests = [
			{
				description: 'resolves the name from the wallet accounts',
				config: { props: {} },
				expected: { name: knownAccount.name }
			},
			{
				description: 'falls back to the default name when the account is unknown',
				config: { props: { address: unknownAccount.address, defaultName: DEFAULT_NAME } },
				expected: { name: DEFAULT_NAME }
			},
			{
				description: 'falls back to the address when no name can be resolved',
				config: { props: { address: unknownAccount.address } },
				expected: { name: unknownAccount.address }
			}
		];

		nameResolutionTests.forEach(test => {
			runNameTest(test.description, test.config, test.expected);
		});
	});

	describe('explicit name and balance', () => {
		const runDisplayTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const screenTester = new ScreenTester(AccountListItem, props);

				// Assert:
				if (expected.visibleTexts)
					screenTester.expectText(expected.visibleTexts);

				if (expected.hiddenTexts)
					screenTester.notExpectText(expected.hiddenTexts);
			});
		};

		const displayTests = [
			{
				description: 'uses the explicit name over the resolved one',
				config: {
					props: { address: unknownAccount.address, name: 'Explicit Name' }
				},
				expected: {
					visibleTexts: ['Explicit Name', unknownAccount.address]
				}
			},
			{
				description: 'renders the balance when provided',
				config: {
					props: {}
				},
				expected: {
					visibleTexts: [TICKER]
				}
			},
			{
				description: 'omits the balance row when no balance is provided (contact-style)',
				config: {
					props: { name: 'Contact Name', balance: undefined, ticker: undefined }
				},
				expected: {
					visibleTexts: ['Contact Name', knownAccount.address],
					hiddenTexts: [TICKER]
				}
			}
		];

		displayTests.forEach(test => {
			runDisplayTest(test.description, test.config, test.expected);
		});
	});

	describe('interaction', () => {
		it('renders the accessory and fires onPress when pressed', () => {
			// Arrange:
			const onPress = jest.fn();
			const props = createProps({
				accessory: <Text>{ACCESSORY_TEXT}</Text>,
				accessibilityLabel: 'sender',
				onPress
			});

			// Act:
			const screenTester = new ScreenTester(AccountListItem, props);
			screenTester.presButtonByLabel('sender');

			// Assert:
			screenTester.expectText([ACCESSORY_TEXT]);
			expect(onPress).toHaveBeenCalled();
		});
	});
});
