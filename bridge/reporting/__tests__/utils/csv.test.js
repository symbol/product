import { REQUEST_ROW, REQUEST_TAB } from '../test-utils/fixtures';
import { REQUEST_CSV_COLUMNS, downloadCsv, formatCsvValue, serializeCsv } from '@/utils/csv';


describe('CSV', () => {
	describe('formatCsvValue', () => {
		it.each([
			['requestAmount', '300000000000', '300000 XYM'],
			['requestAmount', '123456789012345678', '123456789012.345678 XYM'],
			['requestAmount', 0, '0 XYM'],
			['requestAmount', null, '—'],
			['payoutTotalFee', '357429175', '357.429175 WXYM'],
			['payoutNetAmount', '299642570825', '299642.570825 WXYM'],
			['payoutNetAmount', undefined, '—'],
			['payoutConversionRate', '999999', '0.999999'],
			['payoutStatus', 0, 'Unprocessed'],
			['payoutStatus', 1, 'Sent'],
			['payoutStatus', 2, 'Completed'],
			['payoutStatus', 3, 'Failed'],
			['payoutStatus', 99, 'Unknown'],
			['requestTimestamp', 2, '1970-01-01 00:00:02 UTC'],
			['payoutTimestamp', 3, '1970-01-01 00:00:03 UTC'],
			['payoutTimestamp', null, '—'],
			['errorMessage', 'Invalid "address",\nplease retry', '"Invalid ""address"",\nplease retry"'],
			['errorMessage', null, '""'],
			['senderAddress', 'TADDRESS', 'TADDRESS'],
			['requestTransactionSubindex', -1, -1]
		])('formats %s value %p as %p', (key, value, expected) => {
			// Act:
			const result = formatCsvValue(value, key, REQUEST_TAB);

			// Assert:
			expect(result).toBe(expected);
		});
	});

	describe('serializeCsv', () => {
		it('can serialize csv data', () => {
		// Arrange + Act:
			const csv = serializeCsv([REQUEST_ROW], REQUEST_CSV_COLUMNS, REQUEST_TAB);

			// Assert:
			expect(csv).toBe([
				'Sender Address,Request Transaction Hash,Request Transaction Height,Request Transaction Subindex,'
				+ 'Request Timestamp,Request Amount,Destination Address,Payout Transaction Hash,Payout Transaction Height,'
				+ 'Payout Timestamp,Payout Total Fee,Payout Net Amount,Payout Conversion Rate,Payout Status,Error Message',
				`TCONKG47FW2ZEZBPV6G7F422LXBDSMVT3JMYM4I,${'B'.repeat(64)},10,-1,1970-01-01 00:00:02 UTC,300000 XYM,`
				+ `0x1f533cd9711049fA7604D0F49C45B6e5Af30ef8e,${'A'.repeat(64)},11,1970-01-01 00:00:03 UTC,357.429175 WXYM,`
				+ '299642.570825 WXYM,1,Completed,""'
			].join('\n'));
		});
	});


	describe('downloadCsv', () => {
		afterEach(() => jest.restoreAllMocks());

		it('triggers a download with the supplied filename', () => {
			// Arrange:
			const content = '"Address"\n"TADDRESS"';
			const url = 'blob:csv-download';
			Object.assign(jest.spyOn(global, 'URL'), {
				createObjectURL: jest.fn().mockReturnValue(url),
				revokeObjectURL: jest.fn()
			});
			const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

			// Act:
			downloadCsv(content, 'report.csv');

			// Assert:
			expect(click).toHaveBeenCalledTimes(1);
			expect(click.mock.contexts[0]).toMatchObject({ href: url, download: 'report.csv' });
		});
	});
});

