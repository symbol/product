import { CreateContact } from '@/app/screens/address-book/CreateContact';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createAddressBookMock, mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

const NEW_CONTACT_NAME = 'NewContact';
const NEW_CONTACT_ADDRESS = 'TCKJ7VYDVJELN5PCMYAEOHFKQ5IZ7VSSZVHZLDA';
const NEW_CONTACT_NOTES = 'Test notes for new contact';

// Screen Text

const SCREEN_TEXT = {
	textScreenTitle: 's_addressBook_create_title',
	textScreenDescription: 's_addressBook_create_description',
	textTabWhitelist: 's_addressBook_tab_whitelist',
	textTabBlacklist: 's_addressBook_tab_blacklist',
	textAlertWhitelist: 's_addressBook_manageContact_alert_whitelist',
	textAlertBlacklist: 's_addressBook_manageContact_alert_blacklist',
	textDefaultBlacklistName: 's_addressBook_account_blacklist_defaultName',
	inputNameLabel: 'input_name',
	inputAddressLabel: 'input_address',
	inputNotesLabel: 'input_notes',
	buttonSave: 'button_save',
	textValidationRequired: 'validation_error_field_required'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

// Contact List Configurations

const contactsEmpty = [];

// Route Props

const defaultRouteProps = {
	route: {
		params: {}
	}
};

// Setup

const setupMocks = (contacts = contactsEmpty) => {
	mockLocalization();
	const routerMock = mockRouter();
	const addressBookMock = createAddressBookMock(contacts);
	const walletControllerMock = mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		accounts: {
			[NETWORK_IDENTIFIER]: [currentAccount]
		},
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

describe('screens/address-book/CreateContact', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders screen text with title, description, tab selector and form inputs', () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				SCREEN_TEXT.textScreenTitle,
				SCREEN_TEXT.textScreenDescription,
				SCREEN_TEXT.textTabWhitelist,
				SCREEN_TEXT.textTabBlacklist,
				SCREEN_TEXT.inputNameLabel,
				SCREEN_TEXT.inputAddressLabel,
				SCREEN_TEXT.inputNotesLabel,
				SCREEN_TEXT.buttonSave
			];

			// Act:
			const screenTester = new ScreenTester(CreateContact, defaultRouteProps);

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('alert text', () => {
		const runAlertTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks();
				const screenTester = new ScreenTester(CreateContact, defaultRouteProps);

				// Act:
				config.tabsToPress.forEach(tabText => {
					screenTester.pressButton(tabText);
				});

				// Assert:
				screenTester.expectText([expected.alertText]);
				if (expected.hiddenAlertText) 
					screenTester.notExpectText([expected.hiddenAlertText]);
				
			});
		};

		const alertTests = [
			{
				description: 'renders whitelist alert by default',
				config: {
					tabsToPress: []
				},
				expected: {
					alertText: SCREEN_TEXT.textAlertWhitelist,
					hiddenAlertText: SCREEN_TEXT.textAlertBlacklist
				}
			},
			{
				description: 'renders blacklist alert when blacklist tab is pressed',
				config: {
					tabsToPress: [SCREEN_TEXT.textTabBlacklist]
				},
				expected: {
					alertText: SCREEN_TEXT.textAlertBlacklist,
					hiddenAlertText: SCREEN_TEXT.textAlertWhitelist
				}
			},
			{
				description: 'renders whitelist alert when blacklist and whitelist tabs are pressed sequentially',
				config: {
					tabsToPress: [SCREEN_TEXT.textTabBlacklist, SCREEN_TEXT.textTabWhitelist]
				},
				expected: {
					alertText: SCREEN_TEXT.textAlertWhitelist,
					hiddenAlertText: SCREEN_TEXT.textAlertBlacklist
				}
			}
		];

		alertTests.forEach(test => {
			runAlertTest(test.description, test.config, test.expected);
		});
	});

	describe('form validation', () => {
		const runValidationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks();
				const screenTester = new ScreenTester(CreateContact, defaultRouteProps);

				// Act:
				if (config.switchToBlacklist) 
					screenTester.pressButton(SCREEN_TEXT.textTabBlacklist);
				
				if (config.nameToEnter) 
					screenTester.inputText(SCREEN_TEXT.inputNameLabel, config.nameToEnter);
				
				if (config.addressToEnter) 
					screenTester.inputText(SCREEN_TEXT.inputAddressLabel, config.addressToEnter);
				

				// Assert:
				screenTester.expectTextCount(SCREEN_TEXT.textValidationRequired, expected.errorCount);
				if (expected.isButtonDisabled) 
					screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSave);
				 else 
					screenTester.expectButtonEnabled(SCREEN_TEXT.buttonSave);
				
			});
		};

		const validationTests = [
			{
				description: 'shows 2 validation errors when whitelist is selected and name and address are empty',
				config: {
					switchToBlacklist: false,
					nameToEnter: null,
					addressToEnter: null
				},
				expected: {
					errorCount: 2,
					isButtonDisabled: true
				}
			},
			{
				description: 'shows no validation errors when whitelist is selected and name and address are entered',
				config: {
					switchToBlacklist: false,
					nameToEnter: NEW_CONTACT_NAME,
					addressToEnter: NEW_CONTACT_ADDRESS
				},
				expected: {
					errorCount: 0,
					isButtonDisabled: false
				}
			},
			{
				description: 'shows 1 validation error when blacklist is selected and name and address are empty',
				config: {
					switchToBlacklist: true,
					nameToEnter: null,
					addressToEnter: null
				},
				expected: {
					errorCount: 1,
					isButtonDisabled: true
				}
			},
			{
				description: 'shows no validation errors when blacklist is selected and address is entered',
				config: {
					switchToBlacklist: true,
					nameToEnter: null,
					addressToEnter: NEW_CONTACT_ADDRESS
				},
				expected: {
					errorCount: 0,
					isButtonDisabled: false
				}
			}
		];

		validationTests.forEach(test => {
			runValidationTest(test.description, test.config, test.expected);
		});
	});

	describe('save flow', () => {
		const runSaveFlowTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const { addressBook: addressBookMock, router: routerMock } = setupMocks();
				const screenTester = new ScreenTester(CreateContact, defaultRouteProps);

				// Act:
				if (config.switchToBlacklist) 
					screenTester.pressButton(SCREEN_TEXT.textTabBlacklist);
				
				if (config.nameToEnter) 
					screenTester.inputText(SCREEN_TEXT.inputNameLabel, config.nameToEnter);
				
				screenTester.inputText(SCREEN_TEXT.inputAddressLabel, config.addressToEnter);
				if (config.notesToEnter) 
					screenTester.inputText(SCREEN_TEXT.inputNotesLabel, config.notesToEnter);
				
				screenTester.pressButton(SCREEN_TEXT.buttonSave);
				await screenTester.waitForTimer();

				// Assert:
				expect(addressBookMock.addContact).toHaveBeenCalledTimes(1);
				expect(addressBookMock.addContact).toHaveBeenCalledWith(expected.contact);
				expect(routerMock.goBack).toHaveBeenCalledTimes(1);
			});
		};

		const saveFlowTests = [
			{
				description: 'saves whitelist contact with name, address and notes',
				config: {
					switchToBlacklist: false,
					nameToEnter: NEW_CONTACT_NAME,
					addressToEnter: NEW_CONTACT_ADDRESS,
					notesToEnter: NEW_CONTACT_NOTES
				},
				expected: {
					contact: {
						name: NEW_CONTACT_NAME,
						address: NEW_CONTACT_ADDRESS,
						notes: NEW_CONTACT_NOTES,
						isBlackListed: false
					}
				}
			},
			{
				description: 'saves blacklist contact with default name when name is not provided',
				config: {
					switchToBlacklist: true,
					nameToEnter: null,
					addressToEnter: NEW_CONTACT_ADDRESS,
					notesToEnter: NEW_CONTACT_NOTES
				},
				expected: {
					contact: {
						name: SCREEN_TEXT.textDefaultBlacklistName,
						address: NEW_CONTACT_ADDRESS,
						notes: NEW_CONTACT_NOTES,
						isBlackListed: true
					}
				}
			}
		];

		saveFlowTests.forEach(test => {
			runSaveFlowTest(test.description, test.config, test.expected);
		});
	});
});
