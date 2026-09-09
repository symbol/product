import { getAccountDisplayOptions } from '@/app/utils';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { createAddressBookMock, createWalletControllerMock } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const OTHER_NETWORK_IDENTIFIER = 'mainnet';

// Account Fixtures

const currentNetworkAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const otherNetworkAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, OTHER_NETWORK_IDENTIFIER, 0)
	.build();

// Address Book Fixtures

const addressBook = createAddressBookMock([]);

describe('utils/account', () => {
	describe('getAccountDisplayOptions()', () => {
		const runGetAccountDisplayOptionsTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const walletController = createWalletControllerMock({
					chainName: CHAIN_NAME,
					networkIdentifier: NETWORK_IDENTIFIER,
					accounts: {
						[NETWORK_IDENTIFIER]: [currentNetworkAccount],
						[OTHER_NETWORK_IDENTIFIER]: [otherNetworkAccount]
					},
					modules: config.modules
				});

				// Act:
				const result = getAccountDisplayOptions(walletController);

				// Assert:
				expect(result).toStrictEqual({
					walletAccounts: [currentNetworkAccount],
					addressBook: expected.addressBook,
					chainName: CHAIN_NAME,
					networkIdentifier: NETWORK_IDENTIFIER
				});
			});
		};

		const getAccountDisplayOptionsTests = [
			{
				description: 'picks the accounts of the current network and the address book module',
				config: { modules: { addressBook } },
				expected: { addressBook }
			},
			{
				description: 'leaves the address book undefined when the module is absent',
				config: { modules: {} },
				expected: { addressBook: undefined }
			}
		];

		getAccountDisplayOptionsTests.forEach(test => {
			runGetAccountDisplayOptionsTest(test.description, test.config, test.expected);
		});
	});
});
