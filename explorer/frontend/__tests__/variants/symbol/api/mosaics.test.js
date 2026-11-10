import config from '@/app/config';
import * as serverUtils from '@/app/utils/server';
import { stubMosaics } from '@/app/variants/symbol/api/fixtures';
import { fetchMosaicInfo, fetchMosaicPage } from '@/app/variants/symbol/api/mosaics';

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

const symbolApiBaseURL = 'https://explorer.backend/api/symbol';

describe('variants/symbol/api/mosaics', () => {
	beforeEach(() => {
		config.PUBLIC_API_BASE_URL = symbolApiBaseURL;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it.each([
		['a canonical-looking id', '72C0212E67A08BCE', '72C0212E67A08BCE'],
		['a dotted alias', 'symbol.xym', 'symbol.xym'],
		['unsafe characters as one path segment', 'foo/bar?x=1#y', 'foo%2Fbar%3Fx%3D1%23y']
	])('requests %s', async (_description, requestedId, encodedId) => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue({ id: '72C0212E67A08BCE', aliasNames: [] });

		// Act:
		await fetchMosaicInfo(requestedId);

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/mosaic/${encodedId}`);
	});

	it('maps the complete REST DTO from an alias while retaining canonical ID and values', async () => {
		// Arrange:
		const response = {
			id: '72C0212E67A08BCE',
			creator: 'NDE6Y5WNLHID5KRYN3AVNQ7U52XDXLQPHLXHV3OE',
			aliasNames: ['symbol.xym', 'foo.bar'],
			supply: '900719925474099312345',
			divisibility: 6,
			registrationHeight: 123,
			expirationHeight: 456,
			value: 123456789.125,
			isUnlimitedDuration: false,
			isSupplyMutable: true,
			isTransferable: false,
			isRestrictable: true,
			isRevokable: false,
			registrationTimestamp: '2026-10-20 01:02:03'
		};
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(response);

		// Act:
		const result = await fetchMosaicInfo('symbol.xym');

		// Assert:
		expect(result).toEqual({
			id: '72C0212E67A08BCE',
			name: '72C0212E67A08BCE',
			aliasNames: ['symbol.xym', 'foo.bar'],
			namespaceName: '',
			rootNamespaceName: null,
			creator: 'NDE6Y5WNLHID5KRYN3AVNQ7U52XDXLQPHLXHV3OE',
			supply: '900719925474099312345',
			divisibility: 6,
			registrationHeight: 123,
			expirationHeight: 456,
			value: 123456789.125,
			isUnlimitedDuration: false,
			isSupplyMutable: true,
			isTransferable: false,
			isRestrictable: true,
			isRevokable: false,
			registrationTimestamp: '2026-10-20 01:02:03'
		});
	});

	it('maps an empty-alias REST DTO with null and zero values', async () => {
		// Arrange:
		const response = {
			id: '72C0212E67A08BCE',
			aliasNames: [],
			creator: null,
			supply: 0,
			divisibility: 0,
			registrationHeight: 0,
			expirationHeight: null,
			value: 0,
			isUnlimitedDuration: true,
			isSupplyMutable: false,
			isTransferable: false,
			isRestrictable: false,
			isRevokable: false
		};
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(response);

		// Act:
		const result = await fetchMosaicInfo(response.id);

		// Assert:
		expect(result).toEqual({
			id: '72C0212E67A08BCE',
			name: '72C0212E67A08BCE',
			aliasNames: [],
			namespaceName: '',
			rootNamespaceName: null,
			creator: null,
			supply: 0,
			divisibility: 0,
			registrationHeight: 0,
			expirationHeight: null,
			value: 0,
			isUnlimitedDuration: true,
			isSupplyMutable: false,
			isTransferable: false,
			isRestrictable: false,
			isRevokable: false
		});
	});

	it.each([
		[false, 456],
		[true, null]
	])('preserves duration, transferable, and revokable values (%s)', async (isUnlimitedDuration, expirationHeight) => {
		// Arrange:
		const response = {
			id: '72C0212E67A08BCE',
			aliasNames: [],
			creator: 'NDE6Y5WNLHID5KRYN3AVNQ7U52XDXLQPHLXHV3OE',
			supply: 1,
			divisibility: 0,
			registrationHeight: 1,
			expirationHeight,
			value: 1,
			isUnlimitedDuration,
			isSupplyMutable: false,
			isTransferable: true,
			isRestrictable: false,
			isRevokable: true
		};
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(response);

		// Act:
		const result = await fetchMosaicInfo(response.id);

		// Assert:
		expect(result.expirationHeight).toBe(expirationHeight);
		expect(result.isUnlimitedDuration).toBe(isUnlimitedDuration);
		expect(result.isTransferable).toBe(true);
		expect(result.isRevokable).toBe(true);
	});

	it('omits registrationTimestamp when the REST response does not provide it', async () => {
		// Arrange:
		const response = {
			id: '72C0212E67A08BCE',
			aliasNames: [],
			creator: null,
			supply: 0,
			divisibility: 0,
			registrationHeight: 0,
			expirationHeight: null,
			value: 0,
			isUnlimitedDuration: true,
			isSupplyMutable: false,
			isTransferable: false,
			isRestrictable: false,
			isRevokable: false
		};
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(response);

		// Act:
		const result = await fetchMosaicInfo(response.id);

		// Assert:
		expect(result).not.toHaveProperty('registrationTimestamp');
		expect(makeRequest).toHaveBeenCalledTimes(1);
	});

	it.each([400, 404])('returns null for REST status %s', async status => {
		// Arrange:
		const error = { response: { data: { status } } };
		jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

		// Act:
		const result = await fetchMosaicInfo('72C0212E67A08BCE');

		// Assert:
		expect(result).toBeNull();
	});

	it.each([500, 503])('rejects REST status %s', async status => {
		// Arrange:
		const error = { response: { data: { status } } };
		jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

		// Act + Assert:
		await expect(fetchMosaicInfo('72C0212E67A08BCE')).rejects.toBe(error);
	});

	it.each([
		['a network error', new Error('network failure')],
		['a timeout', Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })]
	])('propagates %s', async (_description, error) => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

		// Act + Assert:
		await expect(fetchMosaicInfo('72C0212E67A08BCE')).rejects.toBe(error);
	});

	it('keeps the mosaic page on its existing fixture stub', async () => {
		// Act:
		const firstPage = await fetchMosaicPage();
		const secondPage = await fetchMosaicPage({ pageNumber: 2 });

		// Assert:
		expect(firstPage).toEqual({ data: stubMosaics, pageNumber: 1 });
		expect(secondPage).toEqual({ data: [], pageNumber: 2 });
	});
});
