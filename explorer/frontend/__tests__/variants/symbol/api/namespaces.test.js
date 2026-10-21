import config from '@/app/config';
import * as serverUtils from '@/app/utils/server';
import { stubNamespaces } from '@/app/variants/symbol/api/fixtures';
import { fetchNamespaceInfo, fetchNamespacePage } from '@/app/variants/symbol/api/namespaces';

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

const symbolApiBaseURL = 'https://explorer.backend/api/symbol';

describe('variants/symbol/api/namespaces', () => {
	beforeEach(() => {
		config.PUBLIC_API_BASE_URL = symbolApiBaseURL;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('requests the default page and returns the shared page shape', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		const result = await fetchNamespacePage();

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/namespaces?limit=10&offset=0&sort=DESC`);
		expect(result).toEqual({ data: [], pageNumber: 1 });
	});

	it('converts page number and size to the REST limit and offset', async () => {
		// Arrange:
		const namespaces = [{ id: '0000000000000001', name: '0000000000000001', namespaceName: 'root', startTimestamp: null }];
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(namespaces);

		// Act:
		const result = await fetchNamespacePage({ pageNumber: 3, pageSize: 25 });

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/namespaces?limit=25&offset=50&sort=DESC`);
		expect(result.pageNumber).toBe(3);
		expect(result.data).toEqual([{
			id: '0000000000000001',
			name: 'root',
			namespaceName: 'root',
			startTimestamp: null,
			registrationTimestamp: null
		}]);
	});

	it('converts integer page values supplied as strings to numeric REST pagination', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		const result = await fetchNamespacePage({ pageNumber: '3', pageSize: '25' });

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/namespaces?limit=25&offset=50&sort=DESC`);
		expect(result).toEqual({ data: [], pageNumber: 3 });
	});

	it('passes the supported sort and filters while omitting unknown filters', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);
		const ownerAddress = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI';

		// Act:
		await fetchNamespacePage({
			sort: 'ASC',
			aliasType: 0,
			registrationType: 0,
			ownerAddress,
			unexpected: 'ignored'
		});

		// Assert:
		const expectedURL = `${symbolApiBaseURL}/namespaces?limit=10&offset=0&sort=ASC&aliasType=0&registrationType=0`
			+ `&ownerAddress=${ownerAddress}`;
		expect(makeRequest).toHaveBeenCalledWith(expectedURL);
	});

	it('does not replace invalid supported filter values before REST validation', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		await fetchNamespacePage({ sort: 'invalid', aliasType: 9, registrationType: 2, ownerAddress: 'invalid' });

		// Assert:
		const expectedURL = `${symbolApiBaseURL}/namespaces?limit=10&offset=0&sort=invalid&aliasType=9&registrationType=2`
			+ '&ownerAddress=invalid';
		expect(makeRequest).toHaveBeenCalledWith(expectedURL);
	});

	it('accepts the maximum page size and returns its requested page number', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		const result = await fetchNamespacePage({ pageNumber: 2, pageSize: 100 });

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/namespaces?limit=100&offset=100&sort=DESC`);
		expect(result).toEqual({ data: [], pageNumber: 2 });
	});

	it('accepts the maximum REST offset without changing page numbering', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		const result = await fetchNamespacePage({ pageNumber: 10001, pageSize: 10 });

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/namespaces?limit=10&offset=100000&sort=DESC`);
		expect(result).toEqual({ data: [], pageNumber: 10001 });
	});

	it.each([
		[{ pageNumber: '2x' }, /pageNumber must be an integer/],
		[{ pageNumber: 1.5 }, /pageNumber must be an integer/],
		[{ pageSize: 1.5 }, /pageSize must be an integer/],
		[{ pageNumber: true }, /pageNumber must be an integer/],
		[{ pageSize: null }, /pageSize must be an integer/],
		[{ pageSize: '' }, /pageSize must be an integer/],
		[{ pageNumber: 0 }, /pageNumber must be greater than or equal to 1/],
		[{ pageSize: 0 }, /pageSize must be between/],
		[{ pageSize: 101 }, /pageSize must be between/],
		[{ pageNumber: 10002 }, /offset must be between/]
	])('rejects malformed or out-of-range page input %# without dispatching REST', async (searchParams, expectedError) => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchNamespacePage(searchParams)).rejects.toThrow(expectedError);
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('maps REST names and start timestamps while preserving namespace details', async () => {
		// Arrange:
		const namespaces = [{
			id: '0000000000000002',
			name: '0000000000000002',
			namespaceName: 'root.child',
			namespaceLevels: [
				{ name: 'root', namespaceId: '0000000000000001', parentId: null },
				{ name: 'child', namespaceId: '0000000000000002', parentId: '0000000000000001' }
			],
			aliasType: 'mosaic',
			aliasMosaicId: '85BBEA6CC462B244',
			aliasAddress: null,
			creator: 'NATQ6Q4XK6Y5J2P4M6K3J7Q4D5W6E7R8T9Y0U1I',
			registrationHeight: 123,
			startTimestamp: '2026-10-20 01:02:03',
			registrationType: 'child',
			expirationHeight: null,
			isUnlimitedDuration: true,
			subNamespaceCount: 0
		}];
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(namespaces);

		// Act:
		const result = await fetchNamespacePage({ pageNumber: 2, pageSize: 1 });

		// Assert:
		expect(result).toEqual({
			data: [{
				id: '0000000000000002',
				name: 'root.child',
				namespaceName: 'root.child',
				namespaceLevels: [
					{ name: 'root', namespaceId: '0000000000000001', parentId: null },
					{ name: 'child', namespaceId: '0000000000000002', parentId: '0000000000000001' }
				],
				aliasType: 'mosaic',
				aliasMosaicId: '85BBEA6CC462B244',
				aliasAddress: null,
				creator: 'NATQ6Q4XK6Y5J2P4M6K3J7Q4D5W6E7R8T9Y0U1I',
				registrationHeight: 123,
				startTimestamp: '2026-10-20 01:02:03',
				registrationTimestamp: '2026-10-20 01:02:03',
				registrationType: 'child',
				expirationHeight: null,
				isUnlimitedDuration: true,
				subNamespaceCount: 0
			}],
			pageNumber: 2
		});
	});

	it('preserves REST registration-height order and address alias values', async () => {
		// Arrange:
		const namespaces = [
			{
				id: '0000000000000002',
				name: '0000000000000002',
				namespaceName: 'namespace.thirty',
				registrationHeight: 30,
				aliasType: 'address',
				aliasMosaicId: null,
				aliasAddress: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
				startTimestamp: '2026-10-20 03:00:00'
			},
			{
				id: '0000000000000003',
				name: '0000000000000003',
				namespaceName: 'namespace.twenty',
				registrationHeight: 20,
				aliasType: 'mosaic',
				aliasMosaicId: '85BBEA6CC462B244',
				aliasAddress: null,
				startTimestamp: '2026-10-20 02:00:00'
			},
			{
				id: '0000000000000001',
				name: '0000000000000001',
				namespaceName: 'namespace.ten',
				registrationHeight: 10,
				aliasType: 'none',
				aliasMosaicId: null,
				aliasAddress: null,
				startTimestamp: '2026-10-20 01:00:00'
			}
		];
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(namespaces);

		// Act:
		const result = await fetchNamespacePage();

		// Assert:
		expect(result.data).toEqual([
			{
				id: '0000000000000002',
				name: 'namespace.thirty',
				namespaceName: 'namespace.thirty',
				registrationHeight: 30,
				aliasType: 'address',
				aliasMosaicId: null,
				aliasAddress: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
				startTimestamp: '2026-10-20 03:00:00',
				registrationTimestamp: '2026-10-20 03:00:00'
			},
			{
				id: '0000000000000003',
				name: 'namespace.twenty',
				namespaceName: 'namespace.twenty',
				registrationHeight: 20,
				aliasType: 'mosaic',
				aliasMosaicId: '85BBEA6CC462B244',
				aliasAddress: null,
				startTimestamp: '2026-10-20 02:00:00',
				registrationTimestamp: '2026-10-20 02:00:00'
			},
			{
				id: '0000000000000001',
				name: 'namespace.ten',
				namespaceName: 'namespace.ten',
				registrationHeight: 10,
				aliasType: 'none',
				aliasMosaicId: null,
				aliasAddress: null,
				startTimestamp: '2026-10-20 01:00:00',
				registrationTimestamp: '2026-10-20 01:00:00'
			}
		]);
	});

	it('preserves null, false, and zero DTO values', async () => {
		// Arrange:
		const namespaces = [{
			id: '0000000000000000',
			name: '0000000000000000',
			namespaceName: 'root',
			namespaceLevels: [],
			aliasType: 'none',
			aliasMosaicId: null,
			aliasAddress: null,
			creator: 'NATQ6Q4XK6Y5J2P4M6K3J7Q4D5W6E7R8T9Y0U1I',
			registrationHeight: 0,
			startTimestamp: null,
			registrationType: 'root',
			expirationHeight: 0,
			isUnlimitedDuration: false,
			subNamespaceCount: 0
		}];
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(namespaces);

		// Act:
		const result = await fetchNamespacePage();

		// Assert:
		expect(result.data[0]).toEqual({
			id: '0000000000000000',
			name: 'root',
			namespaceName: 'root',
			namespaceLevels: [],
			aliasType: 'none',
			aliasMosaicId: null,
			aliasAddress: null,
			creator: 'NATQ6Q4XK6Y5J2P4M6K3J7Q4D5W6E7R8T9Y0U1I',
			registrationHeight: 0,
			startTimestamp: null,
			registrationType: 'root',
			expirationHeight: 0,
			isUnlimitedDuration: false,
			subNamespaceCount: 0,
			registrationTimestamp: null
		});
	});

	it('returns an empty page when REST returns no namespaces', async () => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		const result = await fetchNamespacePage({ pageNumber: 2 });

		// Assert:
		expect(result).toEqual({ data: [], pageNumber: 2 });
	});

	it.each([
		['HTTP 400', Object.assign(new Error('bad request'), { response: { status: 400 } })],
		['HTTP 503', Object.assign(new Error('unavailable'), { response: { status: 503 } })],
		['HTTP 500', Object.assign(new Error('server failure'), { response: { status: 500 } })],
		['network', new Error('network unavailable')],
		['timeout', Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })]
	])('propagates %s failures from makeRequest', async (_description, error) => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

		// Act + Assert:
		await expect(fetchNamespacePage()).rejects.toBe(error);
	});

	it('keeps the existing namespace info stub unchanged', async () => {
		// Act:
		const result = await fetchNamespaceInfo('ignored-id');

		// Assert:
		expect(result).toBe(stubNamespaces[0]);
	});
});
