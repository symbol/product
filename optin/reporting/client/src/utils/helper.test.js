import Helper from './helper';
import { waitFor } from '@testing-library/react';

beforeEach(() => {
	fetch.resetMocks();
});

// Arrange:
const expectedTimezone = 'America/Los_Angeles';
jest.mock('moment-timezone', () => {
	const m = jest.requireActual('moment-timezone');
	return {
		...m,
		tz: {
			...m.tz,
			guess: () => {
				return expectedTimezone;
			}
		}
	};
});

describe('Helper', () => {
	describe('toRelativeAmount', () => {
		it('should return relative amount given string integer', () => {
			// Arrange:
			const amount = '1';

			// Act:
			const relativeAmount = Helper.toRelativeAmount(amount);

			// Assert:
			expect(relativeAmount).toBe(0.000001);
		});

		it('should return relative amount given integer', () => {
			// Arrange:
			const amount = 1;

			// Act:
			const relativeAmount = Helper.toRelativeAmount(amount);

			// Assert:
			expect(relativeAmount).toBe(0.000001);
		});

		it('should return undefined given alphabet string', () => {
			// Arrange:
			const amount = 'xym';

			// Act:
			const relativeAmount = Helper.toRelativeAmount(amount);

			// Assert:
			expect(relativeAmount).toBe(undefined);
		});
	});

	describe('convertTimestampToDate', () => {
		// Arrange:
		const unixTimestamp = BigInt(1615853185).toString();

		it('should return default utc date given unix timestamp', () => {
			// Act:
			const date = Helper.convertTimestampToDate(unixTimestamp);

			// Assert:
			expect(date).toBe('21-03-16 00:06:25');
		});

		it('should return custom date given timezone', () => {
			// Act:
			const date = Helper.convertTimestampToDate(unixTimestamp, 'America/Los_Angeles');

			// Assert:
			expect(date).toBe('21-03-15 17:06:25');
		});

		it('should return null date given null', () => {
			// Act:
			const date = Helper.convertTimestampToDate(null);

			// Assert:
			expect(date).toBe(null);
		});
	});

	describe('getLocalTimezone', () => {
		it('should return local timezone', () => {
			// Act:
			const result = Helper.getLocalTimezone();

			// Assert:
			expect(result).toBe(expectedTimezone);
		});
	});

	describe('downloadFile', () => {
		it('should download file', () => {
			// Arrange:
			const fileUrl = 'http://myfile.url';
			global.URL.createObjectURL = jest.fn(() => fileUrl);
			global.Blob = function(content, options) {
				return { content, options };
			};
			const link = {
				click: jest.fn(),
				remove: jest.fn()
			};
			const fileName = 'myfile.csv';

			jest.spyOn(document, 'createElement').mockImplementation(() => link);

			// Act:
			Helper.downloadFile({data: 'File Content', fileName, fileType: 'text/csv'});

			// Assert:
			expect(link.download).toBe(fileName);
			expect(link.href).toBe(fileUrl);
			expect(link.click).toHaveBeenCalledTimes(1);
		});
	});

	describe('downloadAllAsCSV', () => {
		it('should download all as CSV file', async () => {
			// Arrange:
			const data = 'File Content';
			const fileName = 'myfile.csv';
			const fileType = 'text/csv';
			const setDownloading = jest.fn();
			Helper.downloadFile = jest.fn();
			fetch.mockResponse(data);

			// Act:
			await Helper.downloadAllAsCSV({apiUrl: 'http://myfile.url', fileName, setDownloading});

			// Assert:
			await waitFor(() => expect(Helper.downloadFile).toHaveBeenCalledWith({data, fileName, fileType}));
			await waitFor(() => expect(setDownloading).toHaveBeenCalledWith(false));
		});
	});

	describe('copyToClipboard', () => {
		it('should copy given text to clipboard', async () => {
			// Arrange:
			const data = 'Text to copy';
			const textArea = {
				value: '',
				style: {
					position: '',
					left: '',
					top: ''
				},
				focus: jest.fn(),
				select: jest.fn(),
				remove: jest.fn()
			};
			jest.spyOn(document, 'createElement').mockImplementation(() => textArea);
			jest.spyOn(document.body, 'appendChild').mockImplementation(() => jest.fn());
			document.execCommand = jest.fn();

			// Act:
			Helper.copyToClipboard(data);

			// Assert:
			expect(document.execCommand).toHaveBeenCalledWith('copy');

			// clean up
			document.execCommand.mockRestore();
		});
	});
});
