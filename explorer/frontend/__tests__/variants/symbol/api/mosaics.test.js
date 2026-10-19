import * as server from '@/app/utils/server';
import { fetchMosaicPage } from '@/app/variants/symbol/api/mosaics';

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

const mosaicsURL = 'https://explorer.backend/mosaics';

const createMosaic = override => ({
	id: '72C0212E67A08BCE',
	creator: 'TATNE7Q5BITMUTRRN6IB4I7FLSDRDWZA34I2PMQ',
	aliasNames: ['z.example', 'a.example'],
	supply: 1234567,
	divisibility: 6,
	registrationHeight: 123,
	expirationHeight: 579,
	value: 1.234567,
	isUnlimitedDuration: false,
	isSupplyMutable: false,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: true,
	...override
});

describe('variants/symbol/api/mosaics', () => {
	describe('fetchMosaicPage', () => {
		it('requests the default first page and preserves the REST DTO fields', async () => {
			// Arrange:
			const mosaic = createMosaic();
			const makeRequest = jest.spyOn(server, 'makeRequest').mockResolvedValue([mosaic]);

			// Act:
			const result = await fetchMosaicPage();

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith(`${mosaicsURL}?limit=10&offset=0`);
			expect(result).toStrictEqual({
				data: [{
					...mosaic,
					name: '72C0212E67A08BCE',
					namespaceExpirationHeight: 579
				}],
				pageNumber: 1,
				isLastPage: true
			});
		});

		it('uses the ID for the existing list link and preserves aliases without reordering', async () => {
			// Arrange:
			const mosaic = createMosaic();
			const originalAliasNames = [...mosaic.aliasNames];
			jest.spyOn(server, 'makeRequest').mockResolvedValue([mosaic]);

			// Act:
			const result = await fetchMosaicPage();

			// Assert:
			expect(result.data[0].name).toBe('72C0212E67A08BCE');
			expect(result.data[0].aliasNames).toEqual(originalAliasNames);
			expect(mosaic.aliasNames).toEqual(originalAliasNames);
		});

		it('uses the mosaic ID when the REST DTO has no aliases', async () => {
			// Arrange:
			const mosaic = createMosaic({ id: '6BED913FA20223F8', aliasNames: [] });
			jest.spyOn(server, 'makeRequest').mockResolvedValue([mosaic]);

			// Act:
			const result = await fetchMosaicPage();

			// Assert:
			expect(result.data[0]).toStrictEqual({ ...mosaic, name: '6BED913FA20223F8', namespaceExpirationHeight: 579 });
		});

		it('maps unlimited expiration without inventing a registration timestamp', async () => {
			// Arrange:
			const mosaic = createMosaic({ expirationHeight: null, isUnlimitedDuration: true });
			jest.spyOn(server, 'makeRequest').mockResolvedValue([mosaic]);

			// Act:
			const result = await fetchMosaicPage();

			// Assert:
			expect(result.data[0]).toStrictEqual({ ...mosaic, name: '72C0212E67A08BCE', namespaceExpirationHeight: null });
			expect(result.data[0]).not.toHaveProperty('registrationTimestamp');
			expect(mosaic).not.toHaveProperty('name');
			expect(mosaic).not.toHaveProperty('namespaceExpirationHeight');
		});

		it.each([
			['ASC', 'asc'],
			['DESC', 'DESC']
		])('sends the %s sort order when requested', async (expectedSort, sort) => {
			// Arrange:
			jest.spyOn(server, 'makeRequest').mockResolvedValue([]);

			// Act:
			const result = await fetchMosaicPage({ sort });

			// Assert:
			expect(server.makeRequest).toHaveBeenCalledWith(`${mosaicsURL}?limit=10&offset=0&sort=${expectedSort}`);
			expect(result).toStrictEqual({ data: [], pageNumber: 1, isLastPage: true });
		});

		it('requests a distinct next page and preserves the REST response order', async () => {
			// Arrange:
			const firstPage = [
				createMosaic({ id: 'SECOND', aliasNames: ['second'] }),
				createMosaic({ id: 'FIRST', aliasNames: ['first'] })
			];
			const secondPage = [
				createMosaic({ id: 'FOURTH', aliasNames: ['fourth'] }),
				createMosaic({ id: 'THIRD', aliasNames: ['third'] })
			];
			const makeRequest = jest.spyOn(server, 'makeRequest')
				.mockResolvedValueOnce(firstPage)
				.mockResolvedValueOnce(secondPage);

			// Act:
			const firstResult = await fetchMosaicPage({ pageNumber: 1, pageSize: 2, sort: 'ASC' });
			const secondResult = await fetchMosaicPage({ pageNumber: 2, pageSize: 2, sort: 'ASC' });

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, `${mosaicsURL}?limit=2&offset=0&sort=ASC`);
			expect(makeRequest).toHaveBeenNthCalledWith(2, `${mosaicsURL}?limit=2&offset=2&sort=ASC`);
			expect(firstResult.data.map(item => item.id)).toEqual(['SECOND', 'FIRST']);
			expect(firstResult.pageNumber).toBe(1);
			expect(secondResult.data.map(item => item.id)).toEqual(['FOURTH', 'THIRD']);
			expect(secondResult.pageNumber).toBe(2);
			expect(secondResult.isLastPage).toBe(false);
		});

		it.each([
			['pageSize=1', { pageSize: 1 }, `${mosaicsURL}?limit=1&offset=0`, 1],
			['pageSize=100', { pageSize: 100 }, `${mosaicsURL}?limit=100&offset=0`, 1],
			['offset=100000', { pageNumber: 1001, pageSize: 100 }, `${mosaicsURL}?limit=100&offset=100000`, 1001],
			['integer strings', { pageNumber: '3', pageSize: '20' }, `${mosaicsURL}?limit=20&offset=40`, 3]
		])('accepts valid pagination input: %s', async (_description, searchParams, expectedURL, expectedPageNumber) => {
			// Arrange:
			jest.spyOn(server, 'makeRequest').mockResolvedValue([]);

			// Act:
			const result = await fetchMosaicPage(searchParams);

			// Assert:
			expect(server.makeRequest).toHaveBeenCalledWith(expectedURL);
			expect(result.pageNumber).toBe(expectedPageNumber);
		});

		it.each([
			['numeric pageSize=1e21', { pageSize: 1e21 }, 'limit must be a safe integer'],
			['numeric pageNumber=1e21', { pageNumber: 1e21 }, 'pageNumber must be a safe integer'],
			['unsafe integer pageSize string', { pageSize: '9007199254740992' }, 'limit must be a safe integer'],
			['unsafe integer pageNumber string', { pageNumber: '9007199254740992' }, 'pageNumber must be a safe integer'],
			['fractional pageNumber number', { pageNumber: 1.5 }, 'pageNumber must be an integer'],
			['fractional pageNumber string', { pageNumber: '1.5' }, 'pageNumber must be an integer'],
			['fractional pageSize string', { pageSize: '100.1' }, 'limit must be an integer'],
			['non-numeric pageNumber string', { pageNumber: 'first' }, 'pageNumber must be an integer'],
			['boolean pageNumber', { pageNumber: true }, 'pageNumber must be an integer'],
			['boolean pageSize', { pageSize: false }, 'limit must be an integer'],
			['pageNumber=0', { pageNumber: 0 }, 'pageNumber must be at least 1'],
			['negative pageNumber', { pageNumber: -1 }, 'pageNumber must be at least 1'],
			['pageSize=0', { pageSize: 0 }, 'limit must be between 1 and 100'],
			['pageSize=101', { pageSize: 101 }, 'limit must be between 1 and 100'],
			['offset above 100000', { pageNumber: 33335, pageSize: 3 }, 'offset must be between 0 and 100000']
		])('rejects invalid pagination input: %s', async (_description, searchParams, expectedMessage) => {
			// Arrange:
			const makeRequest = jest.spyOn(server, 'makeRequest');

			// Act + Assert:
			await expect(fetchMosaicPage(searchParams)).rejects.toThrow(expectedMessage);
			expect(makeRequest).not.toHaveBeenCalled();
		});

		it.each([
			['undefined values', { pageNumber: undefined, pageSize: undefined }],
			['null values', { pageNumber: null, pageSize: null }]
		])('uses the default first page for %s', async (_description, searchParams) => {
			// Arrange:
			const makeRequest = jest.spyOn(server, 'makeRequest').mockResolvedValue([]);

			// Act:
			const result = await fetchMosaicPage(searchParams);

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith(`${mosaicsURL}?limit=10&offset=0`);
			expect(result).toStrictEqual({ data: [], pageNumber: 1, isLastPage: true });
		});

		it('does not send UI-only parameters or modify search parameters', async () => {
			// Arrange:
			const searchParams = Object.freeze({
				pageNumber: 2,
				pageSize: 5,
				sort: null,
				name: 'ignored filter',
				limit: 1,
				offset: 0,
				other: undefined
			});
			const originalSearchParams = { ...searchParams };
			jest.spyOn(server, 'makeRequest').mockResolvedValue([]);

			// Act:
			await fetchMosaicPage(searchParams);

			// Assert:
			expect(server.makeRequest).toHaveBeenCalledWith(`${mosaicsURL}?limit=5&offset=5`);
			expect(searchParams).toStrictEqual(originalSearchParams);
		});

		it('rejects unsupported sort values before making a request', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(server, 'makeRequest');

			// Act + Assert:
			await expect(fetchMosaicPage({ sort: 'height' })).rejects.toThrow('sort must be either ASC or DESC');
			expect(makeRequest).not.toHaveBeenCalled();
		});

		it('marks a short response as the last page', async () => {
			// Arrange:
			jest.spyOn(server, 'makeRequest').mockResolvedValue([createMosaic()]);

			// Act:
			const result = await fetchMosaicPage({ pageSize: 2 });

			// Assert:
			expect(result.isLastPage).toBe(true);
		});

		it('marks the maximum allowed offset as the last page', async () => {
			// Arrange:
			jest.spyOn(server, 'makeRequest').mockResolvedValue([createMosaic()]);

			// Act:
			const result = await fetchMosaicPage({ pageNumber: 100001, pageSize: 1 });

			// Assert:
			expect(server.makeRequest).toHaveBeenCalledWith(`${mosaicsURL}?limit=1&offset=100000`);
			expect(result.isLastPage).toBe(true);
		});

		it('rejects a non-array response with a descriptive error', async () => {
			// Arrange:
			jest.spyOn(server, 'makeRequest').mockResolvedValue({ data: [] });

			// Act + Assert:
			await expect(fetchMosaicPage()).rejects.toThrow('Symbol mosaics response must be an array');
		});

		it.each([
			['HTTP 400', () => Object.assign(new Error('bad request'), { response: { status: 400 } })],
			['HTTP 404', () => Object.assign(new Error('not found'), { response: { status: 404 } })],
			['HTTP 503', () => Object.assign(new Error('service unavailable'), { response: { status: 503 } })],
			['network failures', () => new Error('network unavailable')],
			['timeouts', () => Object.assign(new Error('request timed out'), { code: 'ECONNABORTED' })]
		])('propagates %s from Explorer REST', async (_description, createError) => {
			// Arrange:
			const error = createError();
			jest.spyOn(server, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchMosaicPage()).rejects.toBe(error);
		});
	});
});
