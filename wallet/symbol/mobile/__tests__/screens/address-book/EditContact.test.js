import { EditContact } from '@/app/screens/address-book/EditContact';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { ContactFixtureBuilder } from '__fixtures__/local/ContactFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createAddressBookMock, mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

const UPDATED_CONTACT_NAME = 'UpdatedContact';
const UPDATED_CONTACT_NOTES = 'Updated notes for contact';

// Screen Text

const SCREEN_TEXT = {
	textScreenTitle: 's_addressBook_edit_title',
	textScreenDescription: 's_addressBook_edit_description',
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

// Contact Fixtures

const contactAlice = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setName('Alice')
	.setNotes('Alice notes')
	.build();

// Contact List Configurations

const contactsWithAlice = [contactAlice];

// Route Props Factory

const createRouteProps = contactId => ({
	route: {
		params: {
			contactId
		}
	}
});

// Setup

const setupMocks = (contacts = contactsWithAlice) => {
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

describe('screens/address-book/EditContact', () => {
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
			setupMocks(contactsWithAlice);
			const routeProps = createRouteProps(contactAlice.id);
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
			const screenTester = new ScreenTester(EditContact, routeProps);

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('alert text', () => {
		const runAlertTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks(config.addressBookContacts);
				const routeProps = createRouteProps(config.contactId);
				const screenTester = new ScreenTester(EditContact, routeProps);

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
				description: 'renders whitelist alert by default for whitelist contact',
				config: {
					addressBookContacts: contactsWithAlice,
					contactId: contactAlice.id,
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
					addressBookContacts: contactsWithAlice,
					contactId: contactAlice.id,
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
					addressBookContacts: contactsWithAlice,
					contactId: contactAlice.id,
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
				setupMocks(config.addressBookContacts);
				const routeProps = createRouteProps(config.contactId);
				const screenTester = new ScreenTester(EditContact, routeProps);

				// Act:
				if (config.switchToBlacklist) 
					screenTester.pressButton(SCREEN_TEXT.textTabBlacklist);
				
				if (config.clearNameInput) 
					screenTester.inputText(SCREEN_TEXT.inputNameLabel, '');
				
				if (config.nameToEnter) 
					screenTester.inputText(SCREEN_TEXT.inputNameLabel, config.nameToEnter);
				

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
				description: 'shows 1 validation error when whitelist is selected and name is cleared',
				config: {
					addressBookContacts: contactsWithAlice,
					contactId: contactAlice.id,
					switchToBlacklist: false,
					clearNameInput: true,
					nameToEnter: null
				},
				expected: {
					errorCount: 1,
					isButtonDisabled: true
				}
			},
			{
				description: 'shows no validation errors when whitelist is selected and name is entered',
				config: {
					addressBookContacts: contactsWithAlice,
					contactId: contactAlice.id,
					switchToBlacklist: false,
					clearNameInput: false,
					nameToEnter: UPDATED_CONTACT_NAME
				},
				expected: {
					errorCount: 0,
					isButtonDisabled: false
				}
			},
			{
				description: 'shows no validation errors when blacklist is selected and name is empty',
				config: {
					addressBookContacts: contactsWithAlice,
					contactId: contactAlice.id,
					switchToBlacklist: true,
					clearNameInput: true,
					nameToEnter: null
				},
				expected: {
					errorCount: 0,
					isButtonDisabled: false
				}
			},
			{
				description: 'shows no validation errors when blacklist is selected and name is entered',
				config: {
					addressBookContacts: contactsWithAlice,
					contactId: contactAlice.id,
					switchToBlacklist: true,
					clearNameInput: false,
					nameToEnter: UPDATED_CONTACT_NAME
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
				const { addressBook: addressBookMock, router: routerMock } = setupMocks(config.addressBookContacts);
				const routeProps = createRouteProps(config.contactId);
				const screenTester = new ScreenTester(EditContact, routeProps);

				// Act:
				if (config.switchToBlacklist) 
					screenTester.pressButton(SCREEN_TEXT.textTabBlacklist);
				
				if (config.clearNameInput) 
					screenTester.inputText(SCREEN_TEXT.inputNameLabel, '');
				
				if (config.nameToEnter) 
					screenTester.inputText(SCREEN_TEXT.inputNameLabel, config.nameToEnter);
				
				if (config.notesToEnter) 
					screenTester.inputText(SCREEN_TEXT.inputNotesLabel, config.notesToEnter);
				
				screenTester.pressButton(SCREEN_TEXT.buttonSave);
				await screenTester.waitForTimer();

				// Assert:
				expect(addressBookMock.updateContact).toHaveBeenCalledTimes(1);
				expect(addressBookMock.updateContact).toHaveBeenCalledWith(expected.contact);
				expect(routerMock.goBack).toHaveBeenCalledTimes(1);
			});
		};

		const saveFlowTests = [
			{
				description: 'updates whitelist contact with name and notes',
				config: {
					addressBookContacts: contactsWithAlice,
					contactId: contactAlice.id,
					switchToBlacklist: false,
					clearNameInput: false,
					nameToEnter: UPDATED_CONTACT_NAME,
					notesToEnter: UPDATED_CONTACT_NOTES
				},
				expected: {
					contact: {
						id: contactAlice.id,
						name: UPDATED_CONTACT_NAME,
						address: contactAlice.address,
						notes: UPDATED_CONTACT_NOTES,
						isBlackListed: false
					}
				}
			},
			{
				description: 'updates blacklist contact with default name when name is cleared',
				config: {
					addressBookContacts: contactsWithAlice,
					contactId: contactAlice.id,
					switchToBlacklist: true,
					clearNameInput: true,
					nameToEnter: null,
					notesToEnter: UPDATED_CONTACT_NOTES
				},
				expected: {
					contact: {
						id: contactAlice.id,
						name: SCREEN_TEXT.textDefaultBlacklistName,
						address: contactAlice.address,
						notes: UPDATED_CONTACT_NOTES,
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
