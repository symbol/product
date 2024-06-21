import { accountPageResult } from '../test-utils/account';
import { blockPageResult } from '../test-utils/blocks';
import { transactionPageResult } from '../test-utils/transactions';
import {
	arrayToText,
	createExpirationLabel,
	createMosaicName,
	decodeTransactionMessage,
	formatAccountCSV,
	formatBlockCSV,
	formatDate,
	formatMosaicCSV,
	formatTransactionCSV,
	formatTransactionChart,
	getRootNamespaceName,
	nullableValueToText,
	numberToShortString,
	numberToString,
	transactionChartFilterToType,
	truncateDecimals,
	truncateString
} from '@/utils/common';

beforeEach(() => {
	Date.prototype.getTimezoneOffset = function () {
		return 160;
	};
});

describe('utils/common', () => {
	describe('formatDate', () => {
		const runFormatDateTest = (timestamp, config, expectedResult) => {
			// Arrange:
			const mockTranslate = jest.fn().mockImplementation(key => `translated_${key}`);

			// Act:
			const result = formatDate(timestamp, mockTranslate, config);

			//Assert:
			expect(result).toBe(expectedResult);
		};

		it('formats date with empty config', () => {
			// Arrange:
			const timestamp = '1900-01-01 01:01:01';
			const config = undefined;
			const expectedResult = 'translated_month_jan 1, 1900';

			// Act & Assert:
			runFormatDateTest(timestamp, config, expectedResult);
		});

		it('formats date with time', () => {
			// Arrange:
			const timestamp = '1970-11-11 11:11:11';
			const config = {
				hasTime: true
			};
			const expectedResult = 'translated_month_nov 11, 1970 • 11:11';

			// Act & Assert:
			runFormatDateTest(timestamp, config, expectedResult);
		});

		it('formats date with tme and seconds', () => {
			// Arrange:
			const timestamp = '1999-12-31 23:59:59';
			const config = {
				hasTime: true,
				hasSeconds: true
			};
			const expectedResult = 'translated_month_dec 31, 1999 • 23:59:59';

			// Act & Assert:
			runFormatDateTest(timestamp, config, expectedResult);
		});

		it('formats date without days', () => {
			// Arrange:
			const timestamp = '2024-06-07 01:01:01';
			const config = {
				hasDays: false
			};
			const expectedResult = 'translated_month_jun, 2024';

			// Act & Assert:
			runFormatDateTest(timestamp, config, expectedResult);
		});

		it('formats date with days, time and seconds in local timezone', () => {
			// Arrange:
			const timestamp = '2024-06-07 01:01:01';
			const config = {
				hasDays: true,
				hasTime: true,
				hasSeconds: true,
				type: 'local'
			};
			const expectedResult = 'translated_month_jun 6, 2024 • 22:21:01';

			// Act & Assert:
			runFormatDateTest(timestamp, config, expectedResult);
		});
	});

	describe('numberToShortString', () => {
		it('returns formatted thousand', () => {
			// Arrange:
			const value = 1234;
			const expectedResult = '1.23K';

			// Act:
			const result = numberToShortString(value);

			// Assert:
			expect(result).toBe(expectedResult);
		});

		it('returns formatted million', () => {
			// Arrange:
			const value = 1_234_567;
			const expectedResult = '1.23M';

			// Act:
			const result = numberToShortString(value);

			// Assert:
			expect(result).toBe(expectedResult);
		});

		it('returns unformatted number', () => {
			// Arrange:
			const value = 123;
			const expectedResult = '123';

			// Act:
			const result = numberToShortString(value);

			// Assert:
			expect(result).toBe(expectedResult);
		});
	});

	describe('numberToString', () => {
		const runNumberToStringTest = (value, expectedResult) => {
			// Act:
			const result = numberToString(value);

			//Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns formatted numeric string', () => {
			// Arrange:
			const value1 = -1234.5678;
			const value2 = 0;
			const value3 = 1234.5678;
			const value4 = 1234;
			const value5 = 0.5678;
			const value6 = 1234567890;
			const value7 = '1234567890';
			const expectedResult1 = '-1 234.5678';
			const expectedResult2 = '0';
			const expectedResult3 = '1 234.5678';
			const expectedResult4 = '1 234';
			const expectedResult5 = '0.5678';
			const expectedResult6 = '1 234 567 890';
			const expectedResult7 = '1 234 567 890';

			// Act & Assert:
			runNumberToStringTest(value1, expectedResult1);
			runNumberToStringTest(value2, expectedResult2);
			runNumberToStringTest(value3, expectedResult3);
			runNumberToStringTest(value4, expectedResult4);
			runNumberToStringTest(value5, expectedResult5);
			runNumberToStringTest(value6, expectedResult6);
			runNumberToStringTest(value7, expectedResult7);
		});

		it('returns empty string if non-numeric value is provided', () => {
			// Arrange:
			const value = 'foo';
			const expectedResult = '';

			// Act & Assert:
			runNumberToStringTest(value, expectedResult);
		});
	});

	describe('truncateDecimals', () => {
		const runTruncateDecimalsTest = (value, decimal, expectedResult) => {
			// Act:
			const result = truncateDecimals(value, decimal);

			//Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns number with truncated decimals', () => {
			// Arrange:
			const value1 = -1234.56789;
			const value2 = 0;
			const value3 = 1234.56789;
			const value4 = 1234.56789;
			const value5 = 1234.56789;
			const decimal1 = 2;
			const decimal2 = 2;
			const decimal3 = 2;
			const decimal4 = 5;
			const decimal5 = 6;

			const expectedResult1 = -1234.56;
			const expectedResult2 = 0;
			const expectedResult3 = 1234.56;
			const expectedResult4 = 1234.56789;
			const expectedResult5 = 1234.56789;

			// Act & Assert:
			runTruncateDecimalsTest(value1, decimal1, expectedResult1);
			runTruncateDecimalsTest(value2, decimal2, expectedResult2);
			runTruncateDecimalsTest(value3, decimal3, expectedResult3);
			runTruncateDecimalsTest(value4, decimal4, expectedResult4);
			runTruncateDecimalsTest(value5, decimal5, expectedResult5);
		});
	});

	describe('truncateString', () => {
		const runTruncateStringTest = (value, type, expectedResult) => {
			// Act:
			const result = truncateString(value, type);

			//Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns truncated address', () => {
			// Arrange:
			const value = 'NBFA6XFBKB3DHJCFDKCMJI5MZ53HFQ56AKDLY4AB';
			const type = 'address';
			const expectedResult = 'NBFA6X...4AB';

			// Act & Assert:
			runTruncateStringTest(value, type, expectedResult);
		});

		it('returns truncated address shorten', () => {
			// Arrange:
			const value = 'NBFA6XFBKB3DHJCFDKCMJI5MZ53HFQ56AKDLY4AB';
			const type = 'address-short';
			const expectedResult = '...4AB';

			// Act & Assert:
			runTruncateStringTest(value, type, expectedResult);
		});

		it('returns truncated transaction hash', () => {
			// Arrange:
			const value = '455DEFA751CBD146A094F4717219E6687ED49A838D028D95E4C5F52938E0B285';
			const type = 'hash';
			const expectedResult = '455D...B285';

			// Act & Assert:
			runTruncateStringTest(value, type, expectedResult);
		});

		it('returns truncated string', () => {
			// Arrange:
			const type = '';
			const value1 = 'Hello world!';
			const value2 = 'Hello!';
			const expectedResult1 = 'Hello wor...';
			const expectedResult2 = 'Hello!';

			// Act & Assert:
			runTruncateStringTest(value1, type, expectedResult1);
			runTruncateStringTest(value2, type, expectedResult2);
		});

		it('returns empty string when non-string provided', () => {
			// Arrange:
			const value = null;
			const type = 'address';
			const expectedResult = '';

			// Act & Assert:
			runTruncateStringTest(value, type, expectedResult);
		});
	});

	describe('nullableValueToText', () => {
		const runNullableValueToTextTest = (value, expectedResult) => {
			// Act:
			const result = nullableValueToText(value);

			//Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns unchanged value when it is not nullish', () => {
			// Arrange:
			const value1 = 1234.5678;
			const value2 = '1234567890';
			const value3 = [];
			const value4 = {};
			const value5 = () => {};
			const value6 = Symbol();
			const expectedResult1 = value1;
			const expectedResult2 = value2;
			const expectedResult3 = value3;
			const expectedResult4 = value4;
			const expectedResult5 = value5;
			const expectedResult6 = value6;

			// Act & Assert:
			runNullableValueToTextTest(value1, expectedResult1);
			runNullableValueToTextTest(value2, expectedResult2);
			runNullableValueToTextTest(value3, expectedResult3);
			runNullableValueToTextTest(value4, expectedResult4);
			runNullableValueToTextTest(value5, expectedResult5);
			runNullableValueToTextTest(value6, expectedResult6);
		});

		it('returns placeholder when value is nullish', () => {
			// Arrange:
			const value1 = null;
			const value2 = undefined;
			const expectedResult1 = '-';
			const expectedResult2 = '-';

			// Act & Assert:
			runNullableValueToTextTest(value1, expectedResult1);
			runNullableValueToTextTest(value2, expectedResult2);
		});
	});

	describe('nullableValueToText', () => {
		const runArrayToTextTest = (value, expectedResult) => {
			// Act:
			const result = arrayToText(value);

			//Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns text string representation of provided array', () => {
			// Arrange:
			const value = ['itemA', 'itemB', 'itemC'];
			const expectedResult = 'itemA, itemB, itemC';

			// Act & Assert:
			runArrayToTextTest(value, expectedResult);
		});

		it('returns placeholder when array is empty', () => {
			// Arrange:
			const value = [];
			const expectedResult = '-';

			// Act & Assert:
			runArrayToTextTest(value, expectedResult);
		});
	});

	describe('getRootNamespaceName', () => {
		const runGetRootNamespaceNameTest = (value, expectedResult) => {
			// Act:
			const result = getRootNamespaceName(value);

			//Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns root name when 3 level name provided', () => {
			// Arrange:
			const value = 'root.sub.mosaic';
			const expectedResult = 'root';

			// Act & Assert:
			runGetRootNamespaceNameTest(value, expectedResult);
		});

		it('returns root name when 2 level name provided', () => {
			// Arrange:
			const value = 'root.sub';
			const expectedResult = 'root';

			// Act & Assert:
			runGetRootNamespaceNameTest(value, expectedResult);
		});

		it('returns root name when 1 level name provided', () => {
			// Arrange:
			const value = 'root';
			const expectedResult = 'root';

			// Act & Assert:
			runGetRootNamespaceNameTest(value, expectedResult);
		});
	});

	describe('createMosaicName', () => {
		it('returns mosaic name using 2 strings separated with dot', () => {
			// Arrange:
			const namespaceId = 'namespace';
			const mosaicId = 'mosaic';
			const expectedResult = 'namespace.mosaic';

			// Act:
			const result = createMosaicName(namespaceId, mosaicId);

			// Assert:
			expect(result).toBe(expectedResult);
		});
	});

	describe('CSV export formatters', () => {
		const runFormatDateTest = (formatter, dataRow, expectedResult) => {
			// Arrange:
			const mockTranslate = jest.fn().mockImplementation(key => `translated_${key}`);

			// Act:
			const result = formatter(dataRow, mockTranslate);

			//Assert:
			expect(result).toStrictEqual(expectedResult);
		};

		it('returns formatted data row containing transaction info', () => {
			// Arrange:
			const formatter = formatTransactionCSV;
			const dataRow = transactionPageResult.data[15];
			const expectedResult = {
				translated_table_field_type: 'translated_transactionType_TRANSFER',
				translated_table_field_sender: 'NBFQ6XFBKB3DHJCFDKCMJI5MZ53HFQ56AKDLY4JK',
				translated_table_field_recipient: 'NBAPJNCPMLPRB3L76GCMO42XRAG4WKYFWMDULIKM',
				translated_table_field_amount: 196.998614,
				translated_table_field_fee: 0.1,
				translated_table_field_timestamp: '2024-03-30 00:57:04',
				translated_table_field_height: 4695078,
				translated_table_field_hash: '455DEFE751CBD146A094F4717219E6687ED49A838D028D95E4C5F52938E0B285',
				translated_table_field_value: '196.998614(nem.xem) 12.34(a.test.test) 8.1(c.test.test) 4(b.test.test)'
			};

			// Act & Assert:
			runFormatDateTest(formatter, dataRow, expectedResult);
		});

		it('returns formatted data row containing account info', () => {
			// Arrange:
			const formatter = formatAccountCSV;
			const dataRow = accountPageResult.data[0];
			const expectedResult = {
				translated_table_field_address: 'NANEPSBUVE5NLYXCTP52LK3YAOSZUAIVOAD4FGSV',
				translated_table_field_balance: 2014883839.88001,
				translated_table_field_importance: 21.075431784224506,
				translated_table_field_isMultisig: 'translated_value_false',
				translated_table_field_isHarvestingActive: 'translated_value_false',
				translated_table_field_description: null
			};

			// Act & Assert:
			runFormatDateTest(formatter, dataRow, expectedResult);
		});

		it('returns formatted data row containing block info', () => {
			// Arrange:
			const formatter = formatBlockCSV;
			const dataRow = blockPageResult.data[0];
			const expectedResult = {
				translated_table_field_height: 4695085,
				translated_table_field_harvester: 'NDE6Y5WNLHID5KRYN3AVNQ7U52XDXLQPHLXHV3OE',
				translated_table_field_transactionCount: 0,
				translated_table_field_totalFee: 0,
				translated_table_field_timestamp: '2024-03-30 01:06:25'
			};

			// Act & Assert:
			runFormatDateTest(formatter, dataRow, expectedResult);
		});

		it('returns formatted data row containing mosaic info', () => {
			// Arrange:
			const formatter = formatMosaicCSV;
			const dataRow = accountPageResult.data[0].mosaics[0];
			const expectedResult = {
				translated_table_field_name: 'nem.xem',
				translated_table_field_amount: 2014883839.88001
			};

			// Act & Assert:
			runFormatDateTest(formatter, dataRow, expectedResult);
		});
	});

	describe('decodeTransactionMessage', () => {
		it('returns message text decoded from hex string', () => {
			// Arrange:
			const messageHex = '48656c6c6f20776f726c6421';
			const expectedResult = 'Hello world!';

			// Act:
			const result = decodeTransactionMessage(messageHex);

			// Assert:
			expect(result).toBe(expectedResult);
		});
	});

	describe('transactionChartFilterToType', () => {
		const runTransactionChartFilterToTypeTest = (filter, expectedResult) => {
			// Act:
			const result = transactionChartFilterToType(filter);

			//Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns daily type', () => {
			// Arrange:
			const filter = { isPerDay: true };
			const expectedResult = 'daily';

			// Act & Assert:
			runTransactionChartFilterToTypeTest(filter, expectedResult);
		});

		it('returns monthly type', () => {
			// Arrange:
			const filter = { isPerMonth: true };
			const expectedResult = 'monthly';

			// Act & Assert:
			runTransactionChartFilterToTypeTest(filter, expectedResult);
		});

		it('returns default block type', () => {
			// Arrange:
			const filter = {};
			const expectedResult = 'block';

			// Act & Assert:
			runTransactionChartFilterToTypeTest(filter, expectedResult);
		});
	});

	describe('formatTransactionChart', () => {
		const runFormatTransactionChartTest = (data, type, expectedResult) => {
			// Arrange:
			const translate = jest.fn().mockImplementation(key => `translated_${key}`);

			// Act:
			const result = formatTransactionChart(data, type, translate);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		};

		it('returns formatted daily chart data', () => {
			// Arrange:
			const data = [
				['2024-03-30', 100],
				['2024-03-31', 200]
			];
			const type = 'daily';
			const expectedResult = [
				['translated_month_mar 30, 2024', 100],
				['translated_month_mar 31, 2024', 200]
			];

			// Act & Assert:
			runFormatTransactionChartTest(data, type, expectedResult);
		});

		it('returns formatted monthly chart data', () => {
			// Arrange:
			const data = [
				['2024-03-01', 100],
				['2024-04-01', 200]
			];
			const type = 'monthly';
			const expectedResult = [
				['translated_month_mar, 2024', 100],
				['translated_month_apr, 2024', 200]
			];

			// Act & Assert:
			runFormatTransactionChartTest(data, type, expectedResult);
		});

		it('returns formatted block chart data', () => {
			// Arrange:
			const data = [
				[100001, 100],
				[100002, 200]
			];
			const type = 'block';
			const expectedResult = [
				['translated_chart_label_block', 100],
				['translated_chart_label_block', 200]
			];

			// Act & Assert:
			runFormatTransactionChartTest(data, type, expectedResult);
		});
	});

	describe('createExpirationLabel', () => {
		const runCreateExpirationLabelTest = (expirationHeight, isUnlimitedDuration, expectedResult) => {
			// Arrange:
			const translate = jest.fn().mockImplementation(key => `translated_${key}`);
			const chainHeight = 100;

			// Act:
			const result = createExpirationLabel(expirationHeight, chainHeight, isUnlimitedDuration, translate);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		};

		it('returns expired status  when chain height is higher than expiration height', () => {
			// Arrange:
			const expirationHeight = 99;
			const isUnlimitedDuration = false;
			const expectedResult = {
				status: 'inactive',
				text: 'translated_label_expired'
			};

			// Act & Assert:
			runCreateExpirationLabelTest(expirationHeight, isUnlimitedDuration, expectedResult);
		});

		it('returns active status when chain height is less than expiration height', () => {
			// Arrange:
			const expirationHeight = 101;
			const isUnlimitedDuration = false;
			const expectedResult = {
				status: 'active',
				text: 'translated_label_active'
			};

			// Act & Assert:
			runCreateExpirationLabelTest(expirationHeight, isUnlimitedDuration, expectedResult);
		});

		it('returns active status when unlimited duration', () => {
			// Arrange:
			const expirationHeight = 101;
			const isUnlimitedDuration = true;
			const expectedResult = {
				status: 'active',
				text: 'translated_label_active'
			};

			// Act & Assert:
			runCreateExpirationLabelTest(expirationHeight, isUnlimitedDuration, expectedResult);
		});
	});
});
