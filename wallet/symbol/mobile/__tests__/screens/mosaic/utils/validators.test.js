import { validateNotSenderAddress } from '@/app/screens/mosaic/utils';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const ERROR_REVOKE_SENDER = 'validation_error_mosaic_revoke_sender';

// Account Fixtures

const senderAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const holderAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

describe('screens/mosaic/utils/validators', () => {
	describe('validateNotSenderAddress', () => {
		const runValidateNotSenderAddressTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const validate = validateNotSenderAddress(senderAccount.address);

				// Act:
				const result = validate(config.address);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const validateNotSenderAddressTests = [
			{
				description: 'accepts an address other than the sender',
				config: { address: holderAccount.address },
				expected: { result: undefined }
			},
			{
				description: 'rejects the sender address',
				config: { address: senderAccount.address },
				expected: { result: ERROR_REVOKE_SENDER }
			},
			{
				description: 'rejects the sender address surrounded by whitespace',
				config: { address: ` ${senderAccount.address} ` },
				expected: { result: ERROR_REVOKE_SENDER }
			}
		];

		validateNotSenderAddressTests.forEach(test => {
			runValidateNotSenderAddressTest(test.description, test.config, test.expected);
		});
	});
});
