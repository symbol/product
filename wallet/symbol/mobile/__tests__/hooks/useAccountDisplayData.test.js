import { useAccountDisplayData } from '@/app/hooks';
import * as useWalletControllerModule from '@/app/hooks/useWalletController';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { ContactFixtureBuilder } from '__fixtures__/local/ContactFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { createAddressBookMock, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

// Real entry from src/config/known-accounts.json (symbol/testnet)
const KNOWN_ACCOUNT_ADDRESS = 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY';
const KNOWN_ACCOUNT_NAME = 'Faucet';
const KNOWN_ACCOUNT_IMAGE_ID = 'faucet';

// Account Fixtures

const walletAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const contactForWalletAccount = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const contact = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const renamedKnownAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setAddress(KNOWN_ACCOUNT_ADDRESS)
	.setName('Renamed Faucet')
	.build();

const unknownAddress = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.build()
	.address;

// Controller Mock

const mockController = ({ walletAccounts = [], contacts } = {}) => mockWalletController({
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	accounts: { [NETWORK_IDENTIFIER]: walletAccounts },
	modules: contacts === undefined ? {} : { addressBook: createAddressBookMock(contacts) }
});

describe('hooks/useAccountDisplayData', () => {
	beforeEach(() => {
		mockController();
	});

	describe('name resolution', () => {
		const runNameResolutionTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockController(config.controller);

				// Act:
				const hookTester = new HookTester(useAccountDisplayData, [config.address]);

				// Assert:
				hookTester.expectResult({
					address: config.address,
					name: expected.name,
					imageId: expected.imageId,
					color: expect.any(String)
				});
			});
		};

		const nameResolutionTests = [
			{
				description: 'resolves the name from the wallet accounts',
				config: {
					controller: { walletAccounts: [walletAccount] },
					address: walletAccount.address
				},
				expected: { name: walletAccount.name, imageId: null }
			},
			{
				description: 'resolves the name from the address book contact',
				config: {
					controller: { walletAccounts: [], contacts: [contact] },
					address: contact.address
				},
				expected: { name: contact.name, imageId: null }
			},
			{
				description: 'prefers the contact name over the wallet account name',
				config: {
					controller: { walletAccounts: [walletAccount], contacts: [contactForWalletAccount] },
					address: walletAccount.address
				},
				expected: { name: contactForWalletAccount.name, imageId: null }
			},
			{
				description: 'prefers the known-config name and image over other sources',
				config: {
					controller: { walletAccounts: [renamedKnownAccount] },
					address: KNOWN_ACCOUNT_ADDRESS
				},
				expected: { name: KNOWN_ACCOUNT_NAME, imageId: KNOWN_ACCOUNT_IMAGE_ID }
			},
			{
				description: 'returns a null name for an unknown address',
				config: {
					controller: { walletAccounts: [walletAccount], contacts: [] },
					address: unknownAddress
				},
				expected: { name: null, imageId: null }
			},
			{
				description: 'resolves when the address book module is absent',
				config: {
					controller: { walletAccounts: [walletAccount] },
					address: walletAccount.address
				},
				expected: { name: walletAccount.name, imageId: null }
			}
		];

		nameResolutionTests.forEach(test => {
			runNameResolutionTest(test.description, test.config, test.expected);
		});
	});

	describe('input shape', () => {
		it('returns a single object for a single address', () => {
			// Arrange:
			mockController({ walletAccounts: [walletAccount] });

			// Act:
			const hookTester = new HookTester(useAccountDisplayData, [walletAccount.address]);

			// Assert:
			expect(Array.isArray(hookTester.currentResult)).toBe(false);
			expect(hookTester.currentResult.address).toBe(walletAccount.address);
		});

		it('returns a list matching the input order for an address list', () => {
			// Arrange:
			mockController({ walletAccounts: [walletAccount] });
			const expectedNames = [walletAccount.name, null];

			// Act:
			const hookTester = new HookTester(useAccountDisplayData, [[walletAccount.address, unknownAddress]]);

			// Assert:
			expect(hookTester.currentResult).toHaveLength(2);
			expect(hookTester.currentResult.map(displayData => displayData.name)).toStrictEqual(expectedNames);
		});

		it('returns an empty list for an empty address list', () => {
			// Act:
			const hookTester = new HookTester(useAccountDisplayData, [[]]);

			// Assert:
			hookTester.expectResult([]);
		});
	});

	describe('memoization', () => {
		it('returns the same result for a new list instance with the same content', () => {
			// Arrange:
			mockController({ walletAccounts: [walletAccount] });
			const hookTester = new HookTester(useAccountDisplayData, [[walletAccount.address, unknownAddress]]);
			const firstResult = hookTester.currentResult;

			// Act:
			hookTester.updateProps([[walletAccount.address, unknownAddress]]);

			// Assert:
			expect(hookTester.currentResult).toBe(firstResult);
		});

		it('recomputes when the address list content changes', () => {
			// Arrange:
			mockController({ walletAccounts: [walletAccount] });
			const hookTester = new HookTester(useAccountDisplayData, [[walletAccount.address]]);
			const firstResult = hookTester.currentResult;

			// Act:
			hookTester.updateProps([[walletAccount.address, unknownAddress]]);

			// Assert:
			expect(hookTester.currentResult).not.toBe(firstResult);
			expect(hookTester.currentResult).toHaveLength(2);
		});
	});

	describe('chain scoping', () => {
		it('forwards the chainName to the wallet controller hook', () => {
			// Act:
			new HookTester(useAccountDisplayData, [[walletAccount.address], 'ethereum']);

			// Assert:
			expect(useWalletControllerModule.useWalletController).toHaveBeenCalledWith('ethereum');
		});
	});
});
