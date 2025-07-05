import { getAccountWithoutPrivateKey } from '../../src/utils/account';

describe('AccountUtils', () => {
	describe('getAccountWithoutPrivateKey()', () => {
		it('returns the object that excludes the privateKey property', () => {
			// Arrange:
			const account = {
				id: '1',
				name: 'Account 1',
				privateKey: 'private-key-1'
			};
			const expectedResult = {
				id: '1',
				name: 'Account 1'
			};

			// Act:
			const result = getAccountWithoutPrivateKey(account);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		});
	});
});
