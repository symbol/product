import { buildBridgeUrl, fetchAllReportRows, fetchBridgeConfiguration, fetchReportPage } from '@/api/bridge';
import config from '@/config';
import { makeGetRequest } from '@/utils/server';

jest.mock('@/utils/server');

describe('bridge API', () => {
	const baseCriteria = {
		baseUrl: 'https://bridge.example/wrapped/',
		operation: 'wrap',
		resource: 'requests',
		offset: 0,
		limit: 100,
		sort: 0
	};

	describe('build report url', () => {
		it('builds an unfiltered request URL with payout status', () => {
			// Arrange:
			const criteria = { ...baseCriteria, payoutStatus: 2 };

			// Act:
			const url = buildBridgeUrl(criteria);

			// Assert:
			expect(url).toBe('https://bridge.example/wrapped/wrap/requests?offset=0&limit=100&sort=0&payout_status=2');
		});

		it('builds an address URL that can match sender or destination', () => {
			// Arrange:
			const address = 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY';

			// Act:
			const url = buildBridgeUrl({ ...baseCriteria, search: address });

			// Assert:
			expect(url).toContain(`/wrap/requests/${address}?`);
		});

		it('builds a hash URL', () => {
			// Arrange:
			const hash = 'a'.repeat(64);

			// Act:
			const url = buildBridgeUrl({ ...baseCriteria, search: `0x${hash}` });

			// Assert:
			expect(url).toContain(`/wrap/requests/hash/${hash.toUpperCase()}?`);
		});

		it('does not send payout status to an errors endpoint', () => {
			// Arrange:
			const criteria = { ...baseCriteria, resource: 'errors', payoutStatus: 3 };

			// Act:
			const url = buildBridgeUrl(criteria);

			// Assert:
			expect(url).not.toContain('payout_status');
		});

		it('rejects unwrap url from the native bridge', () => {
			// Arrange:
			const criteria = {
				...baseCriteria,
				baseUrl: `${config.PUBLIC_BRIDGE_NATIVE_URL}/`,
				operation: 'unwrap'
			};

			// Act:
			const url = () => buildBridgeUrl(criteria);

			// Assert:
			expect(url).toThrow('The native bridge does not support unwrap operations');
		});

		it('rejects an invalid address or transaction hash', () => {
			// Arrange:
			const criteria = { ...baseCriteria, search: 'invalid search' };

			// Act:
			const url = () => buildBridgeUrl(criteria);

			// Assert:
			expect(url).toThrow('Invalid address or transaction hash');
		});
	});

	it('fetches bridge configuration from the base URL', async () => {
		// Arrange:
		makeGetRequest.mockResolvedValue({ enabled: true });

		// Act:
		const configuration = await fetchBridgeConfiguration('https://bridge.example/wrapped/');

		// Assert:
		expect(configuration).toEqual({ enabled: true });
		expect(makeGetRequest).toHaveBeenCalledWith('https://bridge.example/wrapped');
	});

	it('returns pages with data', async () => {
		// Arrange:
		makeGetRequest.mockResolvedValue([{ id: 1 }, { id: 2 }]);

		// Act:
		const page = await fetchReportPage({ ...baseCriteria, limit: 2, offset: 0 });

		// Assert:
		expect(page).toEqual({
			data: [{ id: 1 }, { id: 2 }],
			hasMore: true,
			nextOffset: 2
		});
	});

	it('returns last page', async () => {
		// Arrange:
		makeGetRequest.mockResolvedValue([{ id: 5 }]);

		// Act:
		const page = await fetchReportPage({ ...baseCriteria, limit: 2, offset: 4 });

		// Assert:
		expect(page).toEqual({
			data: [{ id: 5 }],
			hasMore: false,
			nextOffset: 5
		});
	});

	it('fetches all CSV rows until a short page is returned', async () => {
		// Arrange:
		makeGetRequest
			.mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
			.mockResolvedValueOnce([{ id: 3 }]);
		const progress = jest.fn();

		// Act:
		const rows = await fetchAllReportRows({ ...baseCriteria, limit: 2, offset: 0 }, progress);

		// Assert:
		expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
		expect(progress).toHaveBeenNthCalledWith(1, 2);
		expect(progress).toHaveBeenNthCalledWith(2, 3);
	});
});
