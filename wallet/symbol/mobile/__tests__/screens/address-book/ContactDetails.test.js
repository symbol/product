import { config } from '@/app/config';
import { ContactDetails } from '@/app/screens/address-book/ContactDetails';
import { ContactFixtureBuilder } from '__fixtures__/local/ContactFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createAddressBookMock, mockLink, mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const CONTACT_NOTES = 'This is a test note for the contact';

// Explorer URL

const EXPLORER_BASE_URL = config.chains[CHAIN_NAME].explorerURL[NETWORK_IDENTIFIER];

// Screen Text

const SCREEN_TEXT = {
	textFieldAddress: 'fieldTitle_address',
	textFieldNotes: 'fieldTitle_notes',
	textAlertBlacklist: 's_addressBook_contactDetails_alert_blacklist',
	buttonSendTransaction: 'button_sendTransactionToThisAccount',
	buttonOpenExplorer: 'button_openTransactionInExplorer',
	buttonEdit: 'button_edit',
	buttonRemove: 'button_remove'
};

// Contact Fixtures

const contactWhitelisted = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setName('Alice')
	.build();

const contactWhitelistedWithNotes = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setName('Alice')
	.setNotes(CONTACT_NOTES)
	.build();

const contactBlacklisted = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setName('Malicious Actor')
	.setIsBlackListed(true)
	.build();

// Route Props Factory

const createRouteProps = contactId => ({
	route: {
		params: {
			contactId
		}
	}
});

// Setup

const setupMocks = (contacts = []) => {
	mockLocalization();
	const routerMock = mockRouter({
		goToSend: jest.fn(),
		goToEditContact: jest.fn(),
		goBack: jest.fn()
	});
	const addressBookMock = createAddressBookMock(contacts);
	const walletControllerMock = mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		modules: {
			addressBook: addressBookMock
		}
	});

	return {
		walletController: walletControllerMock,
		addressBook: addressBookMock,
		router: routerMock
	};
};

describe('screens/address-book/ContactDetails', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders screen text with address field and action buttons', () => {
			// Arrange:
			setupMocks([contactWhitelisted]);
			const expectedTexts = [
				SCREEN_TEXT.textFieldAddress,
				SCREEN_TEXT.buttonSendTransaction,
				SCREEN_TEXT.buttonOpenExplorer,
				SCREEN_TEXT.buttonEdit,
				SCREEN_TEXT.buttonRemove
			];

			// Act:
			const screenTester = new ScreenTester(
				ContactDetails,
				createRouteProps(contactWhitelisted.id)
			);

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		it('renders contact name and address', () => {
			// Arrange:
			setupMocks([contactWhitelisted]);
			const expectedTexts = [
				contactWhitelisted.name,
				contactWhitelisted.address
			];

			// Act:
			const screenTester = new ScreenTester(
				ContactDetails,
				createRouteProps(contactWhitelisted.id)
			);

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('notes field', () => {
		const runNotesTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks([config.contact]);

				// Act:
				const screenTester = new ScreenTester(
					ContactDetails,
					createRouteProps(config.contact.id)
				);

				// Assert:
				if (expected.isVisible) {
					screenTester.expectText([
						SCREEN_TEXT.textFieldNotes,
						config.contact.notes
					]);
				} else {
					screenTester.notExpectText([SCREEN_TEXT.textFieldNotes]);
				}
			});
		};

		const notesTests = [
			{
				description: 'renders notes field when contact has notes',
				config: {
					contact: contactWhitelistedWithNotes
				},
				expected: {
					isVisible: true
				}
			},
			{
				description: 'does not render notes field when contact has no notes',
				config: {
					contact: contactWhitelisted
				},
				expected: {
					isVisible: false
				}
			}
		];

		notesTests.forEach(test => {
			runNotesTest(test.description, test.config, test.expected);
		});
	});

	describe('alert', () => {
		const runAlertTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks([config.contact]);

				// Act:
				const screenTester = new ScreenTester(
					ContactDetails,
					createRouteProps(config.contact.id)
				);

				// Assert:
				if (expected.isVisible) 
					screenTester.expectText([SCREEN_TEXT.textAlertBlacklist]);
				 else 
					screenTester.notExpectText([SCREEN_TEXT.textAlertBlacklist]);
				
			});
		};

		const alertTests = [
			{
				description: 'renders alert when contact is blacklisted',
				config: {
					contact: contactBlacklisted
				},
				expected: {
					isVisible: true
				}
			},
			{
				description: 'does not render alert when contact is whitelisted',
				config: {
					contact: contactWhitelisted
				},
				expected: {
					isVisible: false
				}
			}
		];

		alertTests.forEach(test => {
			runAlertTest(test.description, test.config, test.expected);
		});
	});

	describe('navigation', () => {
		const runNavigationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { router: routerMock } = setupMocks([config.contact]);
				const openLinkMock = config.mockOpenLink ? mockLink() : null;
				const screenTester = new ScreenTester(
					ContactDetails,
					createRouteProps(config.contact.id)
				);

				// Act:
				screenTester.pressButton(config.buttonText);

				// Assert:
				if (expected.routerMethod) 
					expect(routerMock[expected.routerMethod]).toHaveBeenCalledWith(expected.params);
				
				if (expected.externalUrl) 
					expect(openLinkMock).toHaveBeenCalledWith(expected.externalUrl);
				
			});
		};

		const navigationTests = [
			{
				description: 'navigates to Send screen when send button is pressed',
				config: {
					contact: contactWhitelisted,
					buttonText: SCREEN_TEXT.buttonSendTransaction,
					mockOpenLink: false
				},
				expected: {
					routerMethod: 'goToSend',
					params: {
						params: {
							chainName: CHAIN_NAME,
							recipientAddress: contactWhitelisted.address
						}
					}
				}
			},
			{
				description: 'opens block explorer when explorer button is pressed',
				config: {
					contact: contactWhitelisted,
					buttonText: SCREEN_TEXT.buttonOpenExplorer,
					mockOpenLink: true
				},
				expected: {
					externalUrl: `${EXPLORER_BASE_URL}/accounts/${contactWhitelisted.address}`
				}
			},
			{
				description: 'navigates to EditContact screen when edit button is pressed',
				config: {
					contact: contactWhitelisted,
					buttonText: SCREEN_TEXT.buttonEdit,
					mockOpenLink: false
				},
				expected: {
					routerMethod: 'goToEditContact',
					params: {
						params: {
							contactId: contactWhitelisted.id
						}
					}
				}
			}
		];

		navigationTests.forEach(test => {
			runNavigationTest(test.description, test.config, test.expected);
		});
	});

	describe('remove contact', () => {
		it('removes contact and navigates back when remove button is pressed', async () => {
			// Arrange:
			const { addressBook: addressBookMock, router: routerMock } = setupMocks([contactWhitelisted]);
			const screenTester = new ScreenTester(
				ContactDetails,
				createRouteProps(contactWhitelisted.id)
			);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonRemove);
			await screenTester.waitForTimer();

			// Assert:
			expect(addressBookMock.removeContact).toHaveBeenCalledWith(contactWhitelisted.id);
			expect(routerMock.goBack).toHaveBeenCalledTimes(1);
		});
	});
});
