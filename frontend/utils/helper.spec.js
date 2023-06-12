import {
	absoluteToRelativeAmount,
	createI18n,
	decrypt,
	encrypt,
	relativeToAbsoluteAmount,
	validateNEMAddress,
	validateSymbolAddress
} from './helper';
import crypto from 'crypto';

describe('utils/helper', () => {
	const runBasicValidateAddressTests = (validateAddress, { testnet, mainnet, invalid }) => {
		it('should return true when given correct address', () => {
			// Arrange + Act:
			const result = validateAddress(testnet);

			// Assert:
			expect(result).toEqual(true);
		});

		it('should return false when given mainnet address', () => {
			// Arrange + Act:
			const result = validateAddress(mainnet);

			// Assert:
			expect(result).toEqual(false);
		});

		it('should return false when given invalid address', () => {
			// Arrange + Act:
			const result = validateAddress(invalid);

			// Assert:
			expect(result).toEqual(false);
		});

		it('should return false when given empty address', () => {
			// Arrange + Act:
			const result = validateAddress('');

			// Assert:
			expect(result).toEqual(false);
		});
	};
	describe('validateNEMAddress', () => {
		runBasicValidateAddressTests(
			validateNEMAddress,
			{
				testnet: 'TAZJ3KEPYAQ4G4Y6Q2IRZTQPU7RAKGYZULZURKTO',
				mainnet: 'NAQ7RCYM4PRUAKA7AMBLN4NPBJEJMRCHHJYAVA72',
				invalid: 'TBBIF2LWR6MKXR35DCD5JL46L5RC5ZLX2LMQIPY'
			}
		);
	});

	describe('validateSymbolAddress', () => {
		runBasicValidateAddressTests(
			validateSymbolAddress,
			{
				testnet: 'TBBIF2LWR6MKXR35DCD5JL46L5RC5ZLX2LMQIPY',
				mainnet: 'NBOQGCA6WIB6LUTTHQXAMLJA7EIIEOYPMKOI7MQ',
				invalid: 'TAZJ3KEPYAQ4G4Y6Q2IRZTQPU7RAKGYZULZURKTO'
			}
		);
	});

	describe('absoluteToRelativeAmount', () => {
		it('should return correct relative amount by given absolute amount and divisibility', () => {
			// Arrange + Act:
			const result = absoluteToRelativeAmount(123_456_789, 3);

			// Assert:
			expect(result).toEqual(123_456.789);
		});
	});

	describe('relativeToAbsoluteAmount', () => {
		it('should return correct absolute amount by given relative amount and divisibility', () => {
			// Arrange:
			const amount = 123_456.789;
			const divisibility = 3;
			const expectedResult = 123_456_789;

			// Act:
			const result = relativeToAbsoluteAmount(amount, divisibility);

			// Assert:
			expect(result).toEqual(expectedResult);
		});
	});

	describe('createI18n', () => {
		const runI18nTest = (key, params, expectedResult) => {
			// Arrange:
			const locales = {
				en: {
					translation_key_no_params: 'key no params',
					translation_key_params: 'translation key %param1 %param2'
				}
			};
			const translate = createI18n(locales);

			// Act:
			const result = translate(key, params);

			// Assert:
			expect(result).toEqual(expectedResult);
		};

		it('should return translation string when key exist with params', () => {
			runI18nTest(
				'translation_key_params',
				{
					param1: 'foo',
					param2: 'bar'
				},
				'translation key foo bar'
			);
		});

		it('should return translation string when key exist without params', () => {
			runI18nTest(
				'translation_key_no_params',
				null,
				'key no params'
			);
		});

		it('should return error message when key does not exist with params', () => {
			runI18nTest(
				'wrong_key',
				{
					param1: 'foo',
					param2: 'bar'
				},
				'[missing_translation]wrong_key'
			);
		});

		it('should return error message when key does not exist without params', () => {
			runI18nTest(
				'wrong_key',
				null,
				'[missing_translation]wrong_key'
			);
		});
	});

	describe('crypto encrypt / decrypt', () => {
		const secret = crypto.randomBytes(32).toString('hex');

		it('returns encrypted hex string', () => {
			// Act:
			const result = encrypt('oauth-token-secret', secret);

			// Assert:
			const textParts = result.split(':');
			// vi is 16 bytes
			expect(textParts[0].length).toEqual(32);
			// auth tag is 16 bytes
			expect(textParts[1].length).toEqual(32);
			// encrypted text is 18 bytes
			expect(textParts[2].length).toEqual(36);
			expect(result.length).toEqual(102);
			expect(decrypt(result, secret)).toEqual('oauth-token-secret');
		});

		it('return decrypt value from encrypted string', () => {
			// Act:
			const encrypted = encrypt('oauth-token-secret', secret);
			const result = decrypt(encrypted, secret);

			// Assert:
			expect(result).toEqual('oauth-token-secret');
		});

		it('round trip', () => {
			// Arrange:
			const text = 'test-round-trip';

			// Act:
			const encrypted = encrypt(text, secret);

			// Assert:
			expect(decrypt(encrypted, secret)).toEqual(text);
		});
	});
});
