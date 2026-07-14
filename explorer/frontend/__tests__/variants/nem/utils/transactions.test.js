import { formatTransferMessage } from '@/app/variants/nem/utils/transactions';

describe('variants/nem/utils/transactions', () => {
	describe('formatTransferMessage', () => {
		it('returns decoded plain text for plain messages', () => {
			// Arrange:
			const payload = '48656c6c6f';

			// Act:
			const result = formatTransferMessage(1, payload);

			// Assert:
			expect(result).toEqual({
				type: 'plain',
				text: 'Hello'
			});
		});

		it('returns hex label for plain messages with fe prefix', () => {
			// Arrange:
			const payload = 'feABCD1234';

			// Act:
			const result = formatTransferMessage(1, payload);

			// Assert:
			expect(result).toEqual({
				type: 'hex',
				text: 'HEX: ABCD1234'
			});
		});

		it('returns encrypted payload for non-plain messages', () => {
			// Arrange:
			const payload = 'A1B2C3D4';

			// Act:
			const result = formatTransferMessage(2, payload);

			// Assert:
			expect(result).toEqual({
				type: 'encrypted',
				text: 'A1B2C3D4'
			});
		});

		it('returns null when payload is empty', () => {
			// Act:
			const result = formatTransferMessage(1, '');

			// Assert:
			expect(result).toBeNull();
		});
	});
});
