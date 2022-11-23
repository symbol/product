import {
	absoluteToRelativeAmount,
	relativeToAbsoluteAmount,
	validateNEMAddress
} from './helper';

describe('utils/helper', () => {
	describe('validateNEMAddress', () => {
		it('should return true when given correct address', () => {
			// Arrange:
			const address = 'TAZJ3KEPYAQ4G4Y6Q2IRZTQPU7RAKGYZULZURKTO';

			// Act:
			const result = validateNEMAddress(address);

			// Assert:
			expect(result).toEqual(true);
		});

		it('should return false when given mainnet address', () => {
			// Arrange:
			const address = 'NAQ7RCYM4PRUAKA7AMBLN4NPBJEJMRCHHJYAVA72';

			// Act:
			const result = validateNEMAddress(address);

			// Assert:
			expect(result).toEqual(false);
		});

		it('should return false when given empty address', () => {
			// Arrange:
			const address = '';

			// Act:
			const result = validateNEMAddress(address);

			// Assert:
			expect(result).toEqual(false);
		});
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
});
