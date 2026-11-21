import { MESSAGE_TYPE } from '@/app/constants';
import { formatTransferMessage } from '@/app/variants/symbol/utils/transactions';

describe('variants/symbol/utils/transactions', () => {
	describe('formatTransferMessage', () => {
		it.each([
			[0, '48656C6C6F', { type: MESSAGE_TYPE.PLAIN, text: 'Hello' }],
			[1, '001122', { type: MESSAGE_TYPE.ENCRYPTED, text: '001122' }],
			[254, 'AABBCC', { type: MESSAGE_TYPE.RAW, text: 'HEX: AABBCC' }],
			[0, '', null],
			[0, null, null]
		])('formats message type %s and payload %s', (type, payload, expected) => {
			// Act:
			const result = formatTransferMessage(type, payload);

			// Assert:
			expect(result).toEqual(expected);
		});
	});
});
