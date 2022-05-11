const Utils = require('../../utils/ServerUtils');
const { expect } = require('chai');

describe('server utils', () => {
	describe('toRelativeAmount', () => {
		it('returns relative amount given string integer', () => {
			// Arrange:
			const amount = '1';

			// Act:
			const relativeAmount = Utils.toRelativeAmount(amount);

			// Assert:
			expect(relativeAmount).to.be.equal(0.000001);
		});

		it('returns relative amount given integer', () => {
			// Arrange:
			const amount = 1;

			// Act:
			const relativeAmount = Utils.toRelativeAmount(amount);

			// Assert:
			expect(relativeAmount).to.be.equal(0.000001);
		});

		it('returns undefined given alphabet string', () => {
			// Arrange:
			const amount = 'xym';

			// Act:
			const relativeAmount = Utils.toRelativeAmount(amount);

			// Assert:
			expect(relativeAmount).to.be.equal(undefined);
		});
	});

	describe('byteToHexString', () => {
		it('returns hex given uint 8 array', () => {
			// Arrange:
			const byte = new Uint8Array([
				104, 4, 35, 192, 130, 28, 131,
				242, 247, 23, 168, 248, 242, 123,
				25, 204, 23, 78, 212, 211, 161,
				220, 59, 4, 48
			]);

			// Act:
			const result = Utils.byteToHexString(byte);

			// Assert:
			expect(result).to.be.equal('680423C0821C83F2F717A8F8F27B19CC174ED4D3A1DC3B0430');
		});

		it('returns hex given string', () => {
			// Arrange:
			const byte = '1234';

			// Act:
			const result = Utils.byteToHexString(byte);

			// Assert:
			expect(result).to.be.equal('01020304');
		});

		it('returns empty string without parameter', () => {
			// Arrange + Act:
			const result = Utils.byteToHexString();

			// Assert:
			expect(result).to.be.equal('');
		});
	});

	describe('hexStringToByte', () => {
		it('returns uint 8 array given hex', () => {
			// Arrange:
			const hexString = '680423C0821C83F2F717A8F8F27B19CC174ED4D3A1DC3B0430';

			// Act:
			const addressByte = Utils.hexStringToByte(hexString);

			// Assert:
			expect(addressByte).to.be.eql(new Uint8Array([
				104, 4, 35, 192, 130, 28, 131,
				242, 247, 23, 168, 248, 242, 123,
				25, 204, 23, 78, 212, 211, 161,
				220, 59, 4, 48
			]));
		});

		it('returns empty string without parameter', () => {
			// Arrange + Act:
			const addressHex = Utils.hexStringToByte();

			// Assert:
			expect(addressHex).to.be.eql(new Uint8Array());
		});
	});

	describe('formatStringSplit', () => {
		it('returns array from string contain separator', () => {
			// Arrange:
			const value = 'abc;123';

			// Act:
			const result = Utils.formatStringSplit(value);

			// Assert:
			expect(result).to.be.eql(['abc', '123']);
		});

		it('returns array from string contain custom separator', () => {
			// Arrange:
			const value = 'abc|123';
			const separator = '|';

			// Act:
			const result = Utils.formatStringSplit(value, separator);

			// Assert:
			expect(result).to.be.eql(['abc', '123']);
		});

		it('returns itself given string not contain separator', () => {
			// Arrange:
			const value = 'abc';

			// Act:
			const result = Utils.formatStringSplit(value);

			// Assert:
			expect(result).to.be.eql(value);
		});

		it('returns itself given non string', () => {
			// Arrange:
			const value = 1;

			// Act:
			const result = Utils.formatStringSplit(value);

			// Assert:
			expect(result).to.be.equal(value);
		});
	});

	describe('convertTimestampToDate', () => {
		// Arrange:
		const unixTimestamp = 1615853185;

		it('returns default utc date given unix timestamp', () => {
			// Act:
			const date = Utils.convertTimestampToDate(unixTimestamp);

			// Assert:
			expect(date).to.be.equal('21-03-16 00:06:25');
		});

		it('returns custom date given timezone', () => {
			// Act:
			const date = Utils.convertTimestampToDate(unixTimestamp, 'America/Los_Angeles');

			// Assert:
			expect(date).to.be.equal('21-03-15 17:06:25');
		});
	});
});
