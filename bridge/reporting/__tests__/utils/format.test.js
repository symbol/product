import {
	createExplorerUrl,
	formatAtomicAmount,
	formatPpm,
	formatTimestamp,
	isValueMissing,
	truncateMiddle
} from '@/utils/format';

describe('report formatting', () => {
	describe('isValueMissing', () => {
		const runIsValueMissingTest = (value, expectedResult) => {
			// Act:
			const result = isValueMissing(value);

			// Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns true when value is missing', () => {
			runIsValueMissingTest(null, true);
			runIsValueMissingTest(undefined, true);
		});

		it('returns false when value is defined', () => {
			runIsValueMissingTest('', false);
			runIsValueMissingTest(0, false);
			runIsValueMissingTest(false, false);
		});
	});

	describe('formatTimestamp', () => {
		const runTimestampTest = (input, expectedOutput) => {
			// Act:
			const formattedTimestamp = formatTimestamp(input);

			// Assert:
			expect(formattedTimestamp).toBe(expectedOutput);
		};

		it('formats Unix seconds as UTC', () => {
			runTimestampTest(1759781792.879, '2025-10-06 20:16:32 UTC');
		});

		it('returns a placeholder when timestamp is missing', () => {
			runTimestampTest(null, '—');
		});

		it('returns a placeholder when timestamp is invalid', () => {
			runTimestampTest('hello', '—');
		});
	});

	describe('formatAtomicAmount', () => {
		const runFormatAtomicAmountTest = (value, divisibility, expectedOutput) => {
			// Act:
			const formattedAmount = formatAtomicAmount(value, divisibility);

			// Assert:
			expect(formattedAmount).toBe(expectedOutput);
		};

		it('formats atomic values without losing integer precision', () => {
			runFormatAtomicAmountTest('100000000', 6, '100');
			runFormatAtomicAmountTest('151458904500184', 18, '0.000151458904500184');
			runFormatAtomicAmountTest('999999999999999999999999', 18, '999999.999999999999999999');
		});

		it('returns a placeholder when atomic value is missing', () => {
			runFormatAtomicAmountTest(null, 6, '—');
			runFormatAtomicAmountTest(undefined, 6, '—');
			runFormatAtomicAmountTest('', 6, '—');
		});

		it('returns a nonnumeric atomic value unchanged', () => {
			runFormatAtomicAmountTest('hello', 6, 'hello');
		});

		it('returns an atomic value unchanged when divisibility is zero', () => {
			runFormatAtomicAmountTest('123', 0, '123');
		});

		it('returns an atomic value unchanged when divisibility is missing', () => {
			// Act:
			const formattedAmount = formatAtomicAmount('123');

			// Assert:
			expect(formattedAmount).toBe('123');
		});
	});

	describe('truncateMiddle', () => {
		const runTruncateMiddleTest = (value, expectedOutput, start, end) => {
			// Act:
			const truncatedValue = truncateMiddle(value, start, end);

			// Assert:
			expect(truncatedValue).toBe(expectedOutput);
		};

		it('returns a placeholder when value is missing', () => {
			runTruncateMiddleTest(null, '—');
			runTruncateMiddleTest(undefined, '—');
			runTruncateMiddleTest('', '—');
		});

		it('returns a value at the maximum visible length unchanged', () => {
			runTruncateMiddleTest('12345678901234', '12345678901234');
		});

		it('truncates a long value using default lengths', () => {
			runTruncateMiddleTest('123456789012345', '12345678…012345');
		});

		it('truncates a long value using custom lengths', () => {
			runTruncateMiddleTest('1234567890', '1234…890', 4, 3);
		});
	});

	it('formats conversion rate PPM values', () => {
		// Arrange:
		const rates = ['1000000', '999999', '2000000'];

		// Act:
		const formattedRates = rates.map(formatPpm);

		// Assert:
		expect(formattedRates).toEqual(['1', '0.999999', '2']);
	});

	describe('createExplorerUrl', () => {
		const runExplorerUrlTest = blockchain => {
			// Arrange:
			const explorerUrl = `https://${blockchain}.example`;
			const network = { blockchain, explorerUrl: `${explorerUrl}/` };

			// Act:
			const transactionUrl = createExplorerUrl(network, 'transaction', 'ABC123');
			const accountUrl = createExplorerUrl(network, 'address', 'TADDRESS');

			// Assert:
			expect(transactionUrl).toBe(`${explorerUrl}/transactions/ABC123`);
			expect(accountUrl).toBe(`${explorerUrl}/accounts/TADDRESS`);
		};

		it('creates Symbol explorer URLs', () => {
			runExplorerUrlTest('symbol');
		});

		it('creates NEM explorer URLs', () => {
			runExplorerUrlTest('nem');
		});

		it('creates Ethereum explorer URLs and normalizes transaction hash prefixes', () => {
			// Arrange:
			const network = { blockchain: 'ethereum', explorerUrl: 'https://ethereum.example/' };

			// Act:
			const transactionUrls = [
				createExplorerUrl(network, 'transaction', 'ABC123'),
				createExplorerUrl(network, 'transaction', '0xABC123')
			];
			const addressUrl = createExplorerUrl(network, 'address', '0x123ABC');

			// Assert:
			expect(transactionUrls).toEqual([
				'https://ethereum.example/tx/0xABC123',
				'https://ethereum.example/tx/0xABC123'
			]);
			expect(addressUrl).toBe('https://ethereum.example/address/0x123ABC');
		});

		it('returns null when explorer URL or value is missing', () => {
			// Arrange:
			const network = { blockchain: 'symbol', explorerUrl: 'https://symbol.example' };

			// Act:
			const urls = [
				createExplorerUrl({}, 'transaction', 'ABC123'),
				createExplorerUrl(network, 'transaction', null)
			];

			// Assert:
			expect(urls).toEqual([null, null]);
		});

		it('returns null when blockchain is unsupported', () => {
			// Arrange:
			const network = { blockchain: 'bitcoin', explorerUrl: 'https://bitcoin.example' };

			// Act:
			const url = createExplorerUrl(network, 'transaction', 'ABC123');

			// Assert:
			expect(url).toBeNull();
		});
	});
});
