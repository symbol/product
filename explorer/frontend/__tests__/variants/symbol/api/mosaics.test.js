import { mosaicListResponse } from '../../../../__fixtures__/api/symbol/mosaic-list';
import { mosaicList } from '../../../../__fixtures__/local/symbol/mosaic-list';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import * as server from '@/app/utils/server';
import { fetchMosaicPage } from '@/app/variants/symbol/api/mosaics';

// Mocks

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

// Constants

const mosaicsURL = 'https://explorer.backend/mosaics';
const emptyPageResponse = [];

// Tests

describe('variants/symbol/api/mosaics', () => {
	describe('fetchMosaicPage', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the first page with the default page size when arguments are omitted',
					config: {},
					expected: { url: `${mosaicsURL}?limit=10&offset=0` }
				},
				{
					description: 'requests the given page when "pageNumber" and "pageSize" are provided',
					config: { params: { pageNumber: 2, pageSize: 5 } },
					expected: { url: `${mosaicsURL}?limit=5&offset=5` }
				},
				{
					description: 'parses integer strings with the search criteria helper',
					config: { params: { pageNumber: '3', pageSize: '20' } },
					expected: { url: `${mosaicsURL}?limit=20&offset=40` }
				},
				...['asc', 'DESC'].map(sort => ({
					description: `requests the given ${sort} sort order`,
					config: { params: { sort } },
					expected: { url: `${mosaicsURL}?limit=10&offset=0&sort=${sort.toUpperCase()}` }
				})),
				{
					description: 'leaves limit and offset validation to REST without clamping',
					config: { params: { pageNumber: 1002, pageSize: 101 } },
					expected: { url: `${mosaicsURL}?limit=101&offset=101101` }
				},
				{
					description: 'leaves unsupported sort validation to REST',
					config: { params: { sort: 'height' } },
					expected: { url: `${mosaicsURL}?limit=10&offset=0&sort=HEIGHT` }
				}
			];

			runApiRequestTests({ functionToTest: fetchMosaicPage, response: emptyPageResponse, cases: requestCases });
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps finite and unlimited mosaics with canonical display IDs, aliases, timestamps and amounts',
					config: { response: mosaicListResponse },
					expected: { result: { data: mosaicList, pageNumber: 1, isLastPage: true } }
				},
				{
					description: 'preserves REST row order and the requested page number on a full page',
					config: { response: mosaicListResponse, params: { pageNumber: 2, pageSize: 2, sort: 'ASC' } },
					expected: { result: { data: mosaicList, pageNumber: 2, isLastPage: false } }
				},
				{
					description: 'returns an empty page when there are no mosaics',
					config: { response: emptyPageResponse },
					expected: { result: { data: [], pageNumber: 1, isLastPage: true } }
				},
				{
					description: 'marks the maximum allowed offset as the last page',
					config: { response: [mosaicListResponse[0]], params: { pageNumber: 100001, pageSize: 1 } },
					expected: { result: { data: [mosaicList[0]], pageNumber: 100001, isLastPage: true } }
				},
				{
					description: 'does not invent an absent registration timestamp',
					config: { response: [{ ...mosaicListResponse[0], registrationTimestamp: undefined }] },
					expected: {
						result: { data: [{ ...mosaicList[0], registrationTimestamp: undefined }], pageNumber: 1, isLastPage: true }
					}
				}
			];

			runApiResultTests({ functionToTest: fetchMosaicPage, cases: resultCases });
		});

		// The runners cannot assert rejection identity or input/response preservation.
		it.each([
			['HTTP 400', Object.assign(new Error('bad request'), { response: { status: 400 } })],
			['HTTP 404', Object.assign(new Error('not found'), { response: { status: 404 } })],
			['HTTP 503', Object.assign(new Error('service unavailable'), { response: { status: 503 } })],
			['network failures', new Error('network unavailable')],
			['timeouts', Object.assign(new Error('request timed out'), { code: 'ECONNABORTED' })]
		])('propagates %s from Explorer REST', async (_description, error) => {
			// Arrange:
			jest.spyOn(server, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchMosaicPage()).rejects.toBe(error);
		});

		it('ignores UI-only conditions and preserves the search parameters', async () => {
			// Arrange:
			const searchParams = Object.freeze({ pageNumber: 2, pageSize: 5, sort: null, name: 'ignored', limit: 1, offset: 0 });
			const originalSearchParams = { ...searchParams };
			const makeRequest = jest.spyOn(server, 'makeRequest').mockResolvedValue([]);

			// Act:
			await fetchMosaicPage(searchParams);

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith(`${mosaicsURL}?limit=5&offset=5`);
			expect(searchParams).toStrictEqual(originalSearchParams);
		});

		it('does not mutate the response rows or alias order', async () => {
			// Arrange:
			const response = mosaicListResponse.map(row => ({ ...row, aliasNames: [...row.aliasNames] }));
			const originalResponse = JSON.parse(JSON.stringify(response));
			response.forEach(row => {
				Object.freeze(row.aliasNames);
				Object.freeze(row);
			});
			Object.freeze(response);
			jest.spyOn(server, 'makeRequest').mockResolvedValue(response);

			// Act:
			const result = await fetchMosaicPage();

			// Assert:
			expect(result).toStrictEqual({ data: mosaicList, pageNumber: 1, isLastPage: true });
			expect(response).toStrictEqual(originalResponse);
		});
	});
});
