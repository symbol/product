import { ContactList } from '@/app/screens/address-book/ContactList';
import { ContactListType } from '@/app/screens/address-book/types/AddressBook';
import { ContactFixtureBuilder } from '__fixtures__/local/ContactFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createAddressBookMock, mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Mocks

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	useIsFocused: () => true
}));

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

// Screen Text

const SCREEN_TEXT = {
	textTitle: 's_addressBook_title',
	textDescription: 's_addressBook_description',
	textTabWhitelist: 's_addressBook_tab_whitelist',
	textTabBlacklist: 's_addressBook_tab_blacklist',
	textEmptyList: 'message_emptyList',
	buttonAddContact: 'plus'
};

// Contact Fixtures

const contactAlice = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setName('Alice')
	.build();

const contactBob = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setName('Bob')
	.build();

const contactMalicious = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.setName('Malicious Actor')
	.setIsBlackListed(true)
	.build();

const contactSpammer = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.setName('Spammer')
	.setIsBlackListed(true)
	.build();

// Address Book Contact Configurations

const contactsEmpty = [];
const contactsAll = [contactAlice, contactBob, contactMalicious, contactSpammer];
const contactsOnlyWhitelist = [contactAlice, contactBob];
const contactsOnlyBlacklist = [contactMalicious, contactSpammer];

// Setup

const setupMocks = (contacts = contactsEmpty) => {
	mockLocalization();
	mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		modules: {
			addressBook: createAddressBookMock(contacts)
		}
	});
};

describe('screens/address-book/ContactList', () => {
	describe('render', () => {
		it('renders screen text with title, description and tab selector', () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				SCREEN_TEXT.textTitle,
				SCREEN_TEXT.textDescription,
				SCREEN_TEXT.textTabWhitelist,
				SCREEN_TEXT.textTabBlacklist
			];

			// Act:
			const screenTester = new ScreenTester(ContactList);

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('contact list', () => {
		const runContactListTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks(config.addressBookContacts);
				const screenTester = new ScreenTester(ContactList);

				// Act:
				config.tabsToPress?.forEach(tabText => {
					screenTester.pressButton(tabText);
				});

				// Assert:
				screenTester.expectText(expected.visibleNames);
				screenTester.expectText(expected.visibleAddresses);

				if (expected.hiddenNames?.length > 0)
					screenTester.notExpectText(expected.hiddenNames);
				
				if (expected.hiddenAddresses?.length > 0)
					screenTester.notExpectText(expected.hiddenAddresses);
			});
		};

		const contactListTests = [
			{
				description: 'renders whitelist contacts by default',
				config: {
					addressBookContacts: contactsAll,
					tabsToPress: []
				},
				expected: {
					visibleNames: [contactAlice.name, contactBob.name],
					visibleAddresses: [contactAlice.address, contactBob.address],
					hiddenNames: [contactMalicious.name, contactSpammer.name],
					hiddenAddresses: [contactMalicious.address, contactSpammer.address]
				}
			},
			{
				description: 'renders blacklist contacts when blacklist tab is pressed',
				config: {
					addressBookContacts: contactsAll,
					tabsToPress: [SCREEN_TEXT.textTabBlacklist]
				},
				expected: {
					visibleNames: [contactMalicious.name, contactSpammer.name],
					visibleAddresses: [contactMalicious.address, contactSpammer.address],
					hiddenNames: [contactAlice.name, contactBob.name],
					hiddenAddresses: [contactAlice.address, contactBob.address]
				}
			},
			{
				description: 'renders whitelist contacts when blacklist and whitelist tabs are pressed sequentially',
				config: {
					addressBookContacts: contactsAll,
					tabsToPress: [SCREEN_TEXT.textTabBlacklist, SCREEN_TEXT.textTabWhitelist]
				},
				expected: {
					visibleNames: [contactAlice.name, contactBob.name],
					visibleAddresses: [contactAlice.address, contactBob.address],
					hiddenNames: [contactMalicious.name, contactSpammer.name],
					hiddenAddresses: [contactMalicious.address, contactSpammer.address]
				}
			}
		];

		contactListTests.forEach(test => {
			runContactListTest(test.description, test.config, test.expected);
		});
	});

	describe('empty state', () => {
		const runEmptyStateTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks(config.addressBookContacts);
				const screenTester = new ScreenTester(ContactList);

				// Act:
				config.tabsToPress?.forEach(tabText => {
					screenTester.pressButton(tabText);
				});

				// Assert:
				if (expected.showsEmptyMessage)
					screenTester.expectText([SCREEN_TEXT.textEmptyList]);
				else
					screenTester.notExpectText([SCREEN_TEXT.textEmptyList]);
			});
		};

		const emptyStateTests = [
			{
				description: 'renders empty message when no contacts exist',
				config: {
					addressBookContacts: contactsEmpty,
					tabsToPress: []
				},
				expected: {
					showsEmptyMessage: true
				}
			},
			{
				description: 'renders empty message when whitelist is empty but blacklist has contacts',
				config: {
					addressBookContacts: contactsOnlyBlacklist,
					tabsToPress: []
				},
				expected: {
					showsEmptyMessage: true
				}
			},
			{
				description: 'renders empty message when blacklist is empty but whitelist has contacts',
				config: {
					addressBookContacts: contactsOnlyWhitelist,
					tabsToPress: [SCREEN_TEXT.textTabBlacklist]
				},
				expected: {
					showsEmptyMessage: true
				}
			},
			{
				description: 'does not render empty message when whitelist has contacts',
				config: {
					addressBookContacts: contactsOnlyWhitelist,
					tabsToPress: []
				},
				expected: {
					showsEmptyMessage: false
				}
			}
		];

		emptyStateTests.forEach(test => {
			runEmptyStateTest(test.description, test.config, test.expected);
		});
	});

	describe('navigation', () => {
		it('navigates to CreateContact screen when add contact button is pressed', () => {
			// Arrange:
			setupMocks();
			const routerMock = mockRouter({
				goToCreateContact: jest.fn()
			});
			const screenTester = new ScreenTester(ContactList);

			// Act:
			screenTester.presButtonByLabel(SCREEN_TEXT.buttonAddContact);

			// Assert:
			expect(routerMock.goToCreateContact).toHaveBeenCalledWith({
				params: {
					listType: ContactListType.WHITELIST
				}
			});
		});

		it('navigates to CreateContact screen with blacklist type when on blacklist tab', () => {
			// Arrange:
			setupMocks();
			const routerMock = mockRouter({
				goToCreateContact: jest.fn()
			});
			const screenTester = new ScreenTester(ContactList);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.textTabBlacklist);
			screenTester.presButtonByLabel(SCREEN_TEXT.buttonAddContact);

			// Assert:
			expect(routerMock.goToCreateContact).toHaveBeenCalledWith({
				params: {
					listType: ContactListType.BLACKLIST
				}
			});
		});
	});
});
