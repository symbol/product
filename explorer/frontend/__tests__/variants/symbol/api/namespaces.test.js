import config from '@/app/config';
import * as serverUtils from '@/app/utils/server';
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

	it('fetches a canonical namespace ID and preserves root namespace fields', async () => {
		// Arrange:
		const namespace = {
			id: 'ABCDEF0123456789',
			name: 'ABCDEF0123456789',
			namespaceName: 'root',
			namespaceLevels: [{ name: 'root', namespaceId: 'ABCDEF0123456789', parentId: null }],
			aliasType: 'none',
			aliasMosaicId: null,
			aliasAddress: null,
			creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			registrationHeight: 0,
			startTimestamp: null,
			registrationType: 'root',
			expirationHeight: 0,
			isUnlimitedDuration: false,
			subNamespaceCount: 0,
			subNamespaces: [],
			namespaceMosaics: []
		};
		const inputSnapshot = JSON.parse(JSON.stringify(namespace));
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(namespace);

		// Act:
		const result = await fetchNamespaceInfo('ABCDEF0123456789');

		// Assert:
		expect(makeRequest).toHaveBeenCalledTimes(1);
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/namespace/ABCDEF0123456789`);
		expect(result).toEqual({
			...inputSnapshot,
			name: 'root',
			registrationTimestamp: null,
			subNamespaceHierarchy: [],
			subNamespaces: [],
			namespaceMosaics: []
		});
		expect(JSON.parse(JSON.stringify(result))).toEqual(result);
	});

	it('fetches a namespace by name and maps its child fields', async () => {
		// Arrange:
		const namespace = {
			id: 'E74B99BA41F4AFEE',
			name: 'E74B99BA41F4AFEE',
			namespaceName: 'root.child',
			namespaceLevels: [
				{ name: 'root', namespaceId: 'A95F1F8A96159516', parentId: null },
				{ name: 'child', namespaceId: 'E74B99BA41F4AFEE', parentId: 'A95F1F8A96159516' }
			],
			aliasType: 'mosaic',
			aliasMosaicId: '85BBEA6CC462B244',
			aliasAddress: null,
			creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			registrationHeight: 123,
			startTimestamp: '2026-10-20 01:02:03',
			registrationType: 'child',
			expirationHeight: 456,
			isUnlimitedDuration: false,
			subNamespaceCount: 0,
			subNamespaces: [],
			namespaceMosaics: []
		};
		const inputSnapshot = JSON.parse(JSON.stringify(namespace));
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(namespace);

		// Act:
		const result = await fetchNamespaceInfo('root.child');

		// Assert:
		expect(makeRequest).toHaveBeenCalledTimes(1);
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/namespace/root.child`);
		expect(result).toEqual({
			...inputSnapshot,
			name: 'root.child',
			registrationTimestamp: '2026-10-20 01:02:03',
			subNamespaceHierarchy: [],
			subNamespaces: [],
			namespaceMosaics: []
		});
	});

	it('encodes the namespace path element without a query or extra request', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue({
			namespaceName: 'root.child',
			subNamespaces: [],
			namespaceMosaics: []
		});

		// Act:
		await fetchNamespaceInfo('root.child/leaf?name=1');

		// Assert:
		expect(makeRequest).toHaveBeenCalledTimes(1);
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/namespace/root.child%2Fleaf%3Fname%3D1`);
	});

	it('maps every descendant to its name while retaining hierarchy and order', async () => {
		// Arrange:
		const subNamespaces = [
			{ namespaceId: 'C74B99BA41F4AFEE', namespaceName: 'root.child.leaf', parentId: 'E74B99BA41F4AFEE' },
			{ namespaceId: 'D95F1F8A96159516', namespaceName: 'root.zebra', parentId: 'A95F1F8A96159516' },
			{ namespaceId: 'B95F1F8A96159516', namespaceName: 'root.bird', parentId: 'A95F1F8A96159516' },
			{ namespaceId: 'E74B99BA41F4AFEE', namespaceName: 'root.child', parentId: 'A95F1F8A96159516' }
		];
		const namespace = {
			id: 'A95F1F8A96159516',
			name: 'A95F1F8A96159516',
			namespaceName: 'root',
			namespaceLevels: [{ name: 'root', namespaceId: 'A95F1F8A96159516', parentId: null }],
			aliasType: 'none',
			aliasMosaicId: null,
			aliasAddress: null,
			creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			registrationHeight: 10,
			startTimestamp: '2026-10-20 01:02:03',
			registrationType: 'root',
			expirationHeight: null,
			isUnlimitedDuration: true,
			subNamespaceCount: 4,
			subNamespaces,
			namespaceMosaics: []
		};
		const inputSnapshot = JSON.parse(JSON.stringify(namespace));
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(namespace);

		// Act:
		const result = await fetchNamespaceInfo(namespace.id);

		// Assert:
		expect(result.subNamespaces).toEqual(['root.child.leaf', 'root.zebra', 'root.bird', 'root.child']);
		expect(result.subNamespaceHierarchy).toEqual(inputSnapshot.subNamespaces);
		expect(result.subNamespaceHierarchy.map(item => item.parentId)).toEqual([
			'E74B99BA41F4AFEE', 'A95F1F8A96159516', 'A95F1F8A96159516', 'A95F1F8A96159516'
		]);
		expect(result.name).toBe('root');
		expect(result.id).toBe('A95F1F8A96159516');
		expect(result.registrationTimestamp).toBe('2026-10-20 01:02:03');
	});

	it('preserves Mosaic groups, duplicate Mosaic entries, and detail fields', async () => {
		// Arrange:
		const mosaic = {
			id: '85BBEA6CC462B244',
			creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			aliasNames: ['root.xym'],
			supply: '9007199254740993',
			divisibility: 6,
			registrationHeight: 50,
			expirationHeight: 1000,
			value: '9007199254.740993',
			isUnlimitedDuration: false,
			isSupplyMutable: false,
			isTransferable: true,
			isRestrictable: false,
			isRevokable: false,
			startTimestamp: '2026-10-20 02:03:04'
		};
		const unlimitedMosaic = {
			...mosaic,
			id: '72C0212E67A08BCE',
			aliasNames: [],
			supply: 0,
			divisibility: 0,
			expirationHeight: null,
			value: 0,
			isUnlimitedDuration: true,
			startTimestamp: null
		};
		const namespaceMosaics = [
			{ namespaceId: 'A95F1F8A96159516', namespaceName: 'root', data: [mosaic] },
			{ namespaceId: 'E74B99BA41F4AFEE', namespaceName: 'root.child', data: [mosaic, unlimitedMosaic] },
			{ namespaceId: 'B95F1F8A96159516', namespaceName: 'root.bird', data: [mosaic] }
		];
		const inputSnapshot = JSON.parse(JSON.stringify(namespaceMosaics));
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue({
			id: 'A95F1F8A96159516',
			namespaceName: 'root',
			startTimestamp: null,
			subNamespaces: [],
			namespaceMosaics
		});

		// Act:
		const result = await fetchNamespaceInfo('A95F1F8A96159516');

		// Assert:
		expect(result.namespaceMosaics.map(group => group.namespaceName)).toEqual(['root', 'root.child', 'root.bird']);
		expect(result.namespaceMosaics.map(group => group.data.map(item => item.id))).toEqual([
			['85BBEA6CC462B244'],
			['85BBEA6CC462B244', '72C0212E67A08BCE'],
			['85BBEA6CC462B244']
		]);
		expect(result.namespaceMosaics[0].data[0]).toEqual({
			...inputSnapshot[0].data[0],
			name: '85BBEA6CC462B244',
			namespaceExpirationHeight: 1000,
			registrationTimestamp: '2026-10-20 02:03:04',
			displaySupply: '9007199254.740993'
		});
		expect(result.namespaceMosaics[1].data[1]).toEqual({
			...inputSnapshot[1].data[1],
			name: '72C0212E67A08BCE',
			namespaceExpirationHeight: null,
			registrationTimestamp: null,
			displaySupply: 0
		});
	});

	it('maps namespace detail without mutating the input DTO or nested values', async () => {
		// Arrange:
		const mosaic = {
			id: '85BBEA6CC462B244',
			name: 'root.coin',
			aliasNames: ['root.coin', 'root.child'],
			supply: 0,
			value: 0,
			divisibility: 0,
			isSupplyMutable: false,
			isUnlimitedDuration: false,
			expirationHeight: 1000,
			startTimestamp: null
		};
		const namespace = {
			id: 'A95F1F8A96159516',
			name: 'A95F1F8A96159516',
			namespaceName: 'root',
			namespaceLevels: [{ name: 'root', namespaceId: 'A95F1F8A96159516', parentId: null }],
			startTimestamp: null,
			isUnlimitedDuration: false,
			subNamespaces: [
				{ namespaceId: 'E74B99BA41F4AFEE', namespaceName: 'root.child', parentId: 'A95F1F8A96159516' },
				{ namespaceId: 'C74B99BA41F4AFEE', namespaceName: 'root.child.leaf', parentId: 'E74B99BA41F4AFEE' }
			],
			namespaceMosaics: [
				{ namespaceId: 'A95F1F8A96159516', namespaceName: 'root', data: [mosaic] },
				{ namespaceId: 'E74B99BA41F4AFEE', namespaceName: 'root.child', data: [mosaic] }
			]
		};
		const inputSnapshot = JSON.parse(JSON.stringify(namespace));
		const expectedMosaic = {
			...inputSnapshot.namespaceMosaics[0].data[0],
			name: '85BBEA6CC462B244',
			namespaceExpirationHeight: 1000,
			registrationTimestamp: null,
			displaySupply: 0
		};
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(namespace);

		// Act:
		const result = await fetchNamespaceInfo('A95F1F8A96159516');

		// Assert:
		expect(namespace).toEqual(inputSnapshot);
		expect(result.name).toBe('root');
		expect(result.subNamespaces).toEqual(['root.child', 'root.child.leaf']);
		expect(result.subNamespaces).not.toBe(namespace.subNamespaces);
		expect(result.subNamespaceHierarchy).toEqual(inputSnapshot.subNamespaces);
		expect(result.namespaceLevels).toEqual(inputSnapshot.namespaceLevels);
		expect(result.namespaceMosaics).toEqual([
			{ ...inputSnapshot.namespaceMosaics[0], data: [expectedMosaic] },
			{ ...inputSnapshot.namespaceMosaics[1], data: [expectedMosaic] }
		]);
		expect(result.namespaceMosaics).not.toBe(namespace.namespaceMosaics);
		expect(result.namespaceMosaics[0].data).not.toBe(namespace.namespaceMosaics[0].data);
		expect(result.namespaceMosaics[1].data).not.toBe(namespace.namespaceMosaics[1].data);
		expect(result.namespaceMosaics[0].data[0]).not.toBe(mosaic);
		expect(result.namespaceMosaics[1].data[0]).not.toBe(mosaic);
	});

	it.each([400, 404])('returns null for HTTP %s namespace detail responses', async status => {
		// Arrange:
		const error = Object.assign(new Error(`HTTP ${status}`), { response: { data: { status } } });
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

		// Act:
		const result = await fetchNamespaceInfo('root');

		// Assert:
		expect(result).toBeNull();
		expect(makeRequest).toHaveBeenCalledTimes(1);
	});

	it.each([
		['HTTP 503', Object.assign(new Error('unavailable'), { response: { data: { status: 503 } } })],
		['HTTP 500', Object.assign(new Error('server failure'), { response: { data: { status: 500 } } })],
		['network', new Error('network unavailable')],
		['timeout', Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })]
	])('propagates %s namespace detail failures', async (_description, error) => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

		// Act + Assert:
		await expect(fetchNamespaceInfo('root')).rejects.toBe(error);
	});

	it('uses the REST value for display supply and preserves amount fields and input DTO', async () => {
		// Arrange:
		const mosaic = {
			id: '72C0212E67A08BCE',
			creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			aliasNames: ['root.xym'],
			supply: 8388098149704674,
			divisibility: 6,
			value: 8388098149.704674,
			registrationHeight: 123,
			expirationHeight: 456,
			isUnlimitedDuration: false,
			startTimestamp: '2026-10-20 02:03:04'
		};
		const numericStringMosaic = {
			...mosaic,
			id: '85BBEA6CC462B244',
			supply: '9007199254740993',
			value: '9007199254.740993'
		};
		const zeroMosaic = {
			...mosaic,
			id: '0000000000000000',
			aliasNames: [],
			supply: 0,
			divisibility: 0,
			value: 0
		};
		const namespace = {
			id: 'A95F1F8A96159516',
			namespaceName: 'root',
			startTimestamp: null,
			subNamespaces: [{ namespaceId: 'E74B99BA41F4AFEE', namespaceName: 'root.child', parentId: 'A95F1F8A96159516' }],
			namespaceMosaics: [
				{ namespaceId: 'A95F1F8A96159516', namespaceName: 'root', data: [mosaic, numericStringMosaic, zeroMosaic] },
				{ namespaceId: 'E74B99BA41F4AFEE', namespaceName: 'root.child', data: [mosaic] }
			]
		};
		const inputSnapshot = JSON.parse(JSON.stringify(namespace));
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(namespace);

		// Act:
		const result = await fetchNamespaceInfo(namespace.id);

		// Assert:
		expect(makeRequest).toHaveBeenCalledTimes(1);
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/namespace/${namespace.id}`);
		expect(namespace).toEqual(inputSnapshot);
		expect(result.name).toBe('root');
		expect(result.subNamespaces).toEqual(['root.child']);
		expect(result.subNamespaceHierarchy).toEqual(inputSnapshot.subNamespaces);
		expect(result.namespaceMosaics.map(group => group.namespaceName)).toEqual(['root', 'root.child']);
		expect(result.namespaceMosaics[0].data.map(({ supply, value, displaySupply }) => ({ supply, value, displaySupply })))
			.toEqual([
				{
					supply: 8388098149704674,
					value: 8388098149.704674,
					displaySupply: 8388098149.704674
				},
				{
					supply: '9007199254740993',
					value: '9007199254.740993',
					displaySupply: '9007199254.740993'
				},
				{ supply: 0, value: 0, displaySupply: 0 }
			]);
		expect(result.namespaceMosaics[1].data[0].displaySupply).toBe(8388098149.704674);
	});
});
