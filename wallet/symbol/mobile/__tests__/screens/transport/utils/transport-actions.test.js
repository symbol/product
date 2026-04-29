import { ShareAccountAddressUri, ShareTransferTransactionUri } from '@/app/lib/transport';
import { createWalletActions } from '@/app/screens/transport/utils/transport-actions';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { mockLocalization, mockRouter } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const TOKEN_ID = 'ABCDEF1234567890';
const AMOUNT = '1000000';

// Screen Text

const SCREEN_TEXT = {
	titleAddContact: 's_transportRequest_action_addContact_title',
	titleFillTransferForm: 's_transportRequest_action_fillTransferForm_title',
	descriptionFillTransferForm: 's_transportRequest_action_fillTransferForm_description',
	descriptionFillTransferFormOnlyAddress: 's_transportRequest_action_fillTransferFormOnlyAddress_description'
};

// Account Fixtures

const symbolAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.build();

const symbolRecipientAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 1)
	.build();

const ethereumAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.build();

// Wallet Context Fixtures

const symbolWalletContext = { chainName: CHAIN_NAME_SYMBOL };
const ethereumWalletContext = { chainName: CHAIN_NAME_ETHEREUM };

// Transport URI Fixtures

const symbolAccountAddressUri = new ShareAccountAddressUri({
	chainName: CHAIN_NAME_SYMBOL,
	networkIdentifier: NETWORK_IDENTIFIER,
	address: symbolAccount.address,
	name: symbolAccount.name
});

const ethereumAccountAddressUri = new ShareAccountAddressUri({
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	address: ethereumAccount.address,
	name: ethereumAccount.name
});

const symbolTransferTransactionUri = new ShareTransferTransactionUri({
	chainName: CHAIN_NAME_SYMBOL,
	networkIdentifier: NETWORK_IDENTIFIER,
	recipientAddress: symbolRecipientAccount.address,
	tokenId: TOKEN_ID,
	amount: AMOUNT
});

const ethereumTransferTransactionUri = new ShareTransferTransactionUri({
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	recipientAddress: ethereumAccount.address,
	tokenId: TOKEN_ID,
	amount: AMOUNT
});

describe('screens/transport/utils/transport-actions', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('createWalletActions', () => {
		describe('null input', () => {
			it('returns empty action lists when transport URI is null', () => {
				// Act & Assert:
				expect(createWalletActions(null, symbolWalletContext)).toEqual({ suggested: [], other: [] });
				expect(createWalletActions(null)).toEqual({ suggested: [], other: [] });
			});
		});

		describe('action filtering', () => {
			const runActionFilteringTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const { uri, context } = config;

					// Act:
					const result = createWalletActions(uri, context);

					// Assert:
					expect(result.suggested.map(a => a.title)).toEqual(expected.suggestedTitles);
					expect(result.other.map(a => a.title)).toEqual(expected.otherTitles);
				});
			};

			const actionFilteringTests = [
				// ACCOUNT_ADDRESS

				{
					description: 'ACCOUNT_ADDRESS with matching chain: ADD_CONTACT in suggested, FILL_TRANSFER_FORM in other',
					config: { uri: symbolAccountAddressUri, context: symbolWalletContext },
					expected: {
						suggestedTitles: [SCREEN_TEXT.titleAddContact],
						otherTitles: [SCREEN_TEXT.titleFillTransferForm]
					}
				},
				{
					description: 'ACCOUNT_ADDRESS with non-matching chain: no suggested, FILL_TRANSFER_FORM in other',
					config: { uri: ethereumAccountAddressUri, context: symbolWalletContext },
					expected: {
						suggestedTitles: [],
						otherTitles: [SCREEN_TEXT.titleFillTransferForm]
					}
				},
				{
					description: 'ACCOUNT_ADDRESS without context: no suggested, FILL_TRANSFER_FORM in other',
					config: { uri: symbolAccountAddressUri, context: undefined },
					expected: {
						suggestedTitles: [],
						otherTitles: [SCREEN_TEXT.titleFillTransferForm]
					}
				},

				// TRANSFER_TRANSACTION

				{
					description: 'TRANSFER_TRANSACTION with matching chain: FILL_TRANSFER_FORM in suggested, ADD_CONTACT in other',
					config: { uri: symbolTransferTransactionUri, context: symbolWalletContext },
					expected: {
						suggestedTitles: [SCREEN_TEXT.titleFillTransferForm],
						otherTitles: [SCREEN_TEXT.titleAddContact]
					}
				},
				{
					description: 'TRANSFER_TRANSACTION with non-matching chain: FILL_TRANSFER_FORM in suggested, no other',
					config: { uri: ethereumTransferTransactionUri, context: symbolWalletContext },
					expected: {
						suggestedTitles: [SCREEN_TEXT.titleFillTransferForm],
						otherTitles: []
					}
				},
				{
					description: 'TRANSFER_TRANSACTION without context: FILL_TRANSFER_FORM in suggested, no other',
					config: { uri: symbolTransferTransactionUri, context: undefined },
					expected: {
						suggestedTitles: [SCREEN_TEXT.titleFillTransferForm],
						otherTitles: []
					}
				}
			];

			actionFilteringTests.forEach(test => {
				runActionFilteringTest(test.description, test.config, test.expected);
			});
		});

		describe('action descriptions', () => {
			it('FILL_TRANSFER_FORM_ONLY_ADDRESS uses only-address description when scanning an account address URI', () => {
				// Act:
				const result = createWalletActions(symbolAccountAddressUri, symbolWalletContext);

				// Assert:
				expect(result.other[0].description).toBe(SCREEN_TEXT.descriptionFillTransferFormOnlyAddress);
			});

			it('FILL_TRANSFER_FORM uses standard description when scanning a transfer transaction URI', () => {
				// Act:
				const result = createWalletActions(symbolTransferTransactionUri, symbolWalletContext);

				// Assert:
				expect(result.suggested[0].description).toBe(SCREEN_TEXT.descriptionFillTransferForm);
			});
		});

		describe('action handlers', () => {
			it('ADD_CONTACT handler navigates to CreateContact with address and name from the scanned account URI', () => {
				// Arrange:
				const routerMock = mockRouter({ goToCreateContact: jest.fn() });
				const result = createWalletActions(symbolAccountAddressUri, symbolWalletContext);

				// Act:
				result.suggested[0].handlePress();

				// Assert:
				expect(routerMock.goToCreateContact).toHaveBeenCalledWith({
					params: {
						name: symbolAccount.name,
						address: symbolAccount.address
					}
				});
			});

			it('FILL_TRANSFER_FORM handler navigates to Send with full transaction details', () => {
				// Arrange:
				const routerMock = mockRouter({ goToSend: jest.fn() });
				const result = createWalletActions(symbolTransferTransactionUri, symbolWalletContext);

				// Act:
				result.suggested[0].handlePress();

				// Assert:
				expect(routerMock.goToSend).toHaveBeenCalledWith({
					params: {
						chainName: CHAIN_NAME_SYMBOL,
						recipientAddress: symbolRecipientAccount.address,
						tokenId: TOKEN_ID,
						amount: AMOUNT
					}
				});
			});

			it('FILL_TRANSFER_FORM handler navigates to Send with ethereum chain details', () => {
				// Arrange:
				const routerMock = mockRouter({ goToSend: jest.fn() });
				const result = createWalletActions(ethereumTransferTransactionUri, ethereumWalletContext);

				// Act:
				result.suggested[0].handlePress();

				// Assert:
				expect(routerMock.goToSend).toHaveBeenCalledWith({
					params: {
						chainName: CHAIN_NAME_ETHEREUM,
						recipientAddress: ethereumAccount.address,
						tokenId: TOKEN_ID,
						amount: AMOUNT
					}
				});
			});

			it('FILL_TRANSFER_FORM_ONLY_ADDRESS handler navigates to Send using account address as recipient', () => {
				// Arrange:
				const routerMock = mockRouter({ goToSend: jest.fn() });
				const result = createWalletActions(symbolAccountAddressUri, symbolWalletContext);

				// Act:
				result.other[0].handlePress();

				// Assert:
				expect(routerMock.goToSend).toHaveBeenCalledWith({
					params: {
						chainName: CHAIN_NAME_SYMBOL,
						recipientAddress: symbolAccount.address,
						tokenId: undefined,
						amount: undefined
					}
				});
			});

			it('TRANSFER_TRANSACTION ADD_CONTACT handler navigates to CreateContact with recipient address', () => {
				// Arrange:
				const routerMock = mockRouter({ goToCreateContact: jest.fn() });
				const result = createWalletActions(symbolTransferTransactionUri, symbolWalletContext);

				// Act:
				result.other[0].handlePress();

				// Assert:
				expect(routerMock.goToCreateContact).toHaveBeenCalledWith({
					params: {
						name: undefined,
						address: symbolRecipientAccount.address
					}
				});
			});
		});
	});
});
