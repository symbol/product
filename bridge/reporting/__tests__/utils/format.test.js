import { createExplorerUrl, formatAtomicAmount, formatPpm, formatTimestamp } from '@/utils/format';

describe('report formatting', () => {
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

	it('formats atomic values without losing integer precision', () => {
		// Arrange:
		const inputs = [
			['100000000', 6],
			['151458904500184', 18],
			['999999999999999999999999', 18]
		];

		// Act:
		const formattedAmounts = inputs.map(([value, divisibility]) => formatAtomicAmount(value, divisibility));

		// Assert:
		expect(formattedAmounts).toEqual(['100', '0.000151458904500184', '999999.999999999999999999']);
	});

	it('formats conversion rate PPM values', () => {
		// Arrange:
		const rates = ['1000000', '999999', '2000000'];

		// Act:
		const formattedRates = rates.map(formatPpm);

		// Assert:
		expect(formattedRates).toEqual(['1', '0.999999', '2']);
	});

	it('creates Symbol explorer URLs', () => {
		// Arrange:
		const network = { blockchain: 'symbol', explorerUrl: 'https://symbol.example/' };

		// Act:
		const transactionUrl = createExplorerUrl(network, 'transaction', 'ABC123');
		const accountUrl = createExplorerUrl(network, 'address', 'TADDRESS');

		// Assert:
		expect(transactionUrl).toBe('https://symbol.example/transactions/ABC123');
		expect(accountUrl).toBe('https://symbol.example/accounts/TADDRESS');
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
});
