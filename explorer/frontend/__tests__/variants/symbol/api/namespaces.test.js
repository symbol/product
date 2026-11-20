import { namespaceListResponse } from '../../../../__fixtures__/api/symbol/namespace-list';
import { namespaceList } from '../../../../__fixtures__/local/symbol/namespace-list';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import * as serverUtils from '@/app/utils/server';
import { stubNamespaces } from '@/app/variants/symbol/api/fixtures';
import { fetchNamespaceInfo, fetchNamespacePage } from '@/app/variants/symbol/api/namespaces';

// Mocks

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

// Constants

const namespacesURL = 'https://explorer.backend/namespaces';
const emptyPageResponse = [];
const ownerAddress = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI';

// Tests

describe('variants/symbol/api/namespaces', () => {
	describe('fetchNamespacePage', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the first page with the default page size',
					config: { params: {} },
					expected: { url: `${namespacesURL}?limit=10&offset=0&sort=DESC` }
				},
				{
					description: 'requests the given page number and size',
					config: { params: { pageNumber: 3, pageSize: 25 } },
					expected: { url: `${namespacesURL}?limit=25&offset=50&sort=DESC` }
				},
				{
					description: 'passes supported filters including zero-valued enum filters',
					config: {
						params: {
							sort: 'ASC',
							aliasType: 0,
							registrationType: 0,
							ownerAddress,
							unexpected: 'ignored'
						}
					},
					expected: {
						url: `${namespacesURL}?limit=10&offset=0&sort=ASC&aliasType=0&registrationType=0&ownerAddress=${ownerAddress}`
					}
				},
				{
					description: 'keeps explicit undefined and null filters while ignoring inherited filters',
					config: {
						params: Object.assign(Object.create({ ownerAddress }), {
							sort: undefined,
							aliasType: 0,
							registrationType: null,
							pageNumber: 2
						})
					},
					expected: {
						url: `${namespacesURL}?limit=10&offset=10&sort=undefined&aliasType=0&registrationType=null`
					}
				}
			];

			runApiRequestTests({
				functionToTest: fetchNamespacePage,
				response: emptyPageResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps namespace names and timestamps while preserving IDs and REST order',
					config: { response: namespaceListResponse },
					expected: {
						result: {
							data: namespaceList,
							pageNumber: 1
						}
					}
				},
				{
					description: 'preserves a null start timestamp as a null registration timestamp',
					config: { response: [{ ...namespaceListResponse[0], startTimestamp: null }] },
					expected: {
						result: {
							data: [{ ...namespaceList[0], startTimestamp: null, registrationTimestamp: null }],
							pageNumber: 1
						}
					}
				},
				{
					description: 'returns an empty page with the requested page number',
					config: { params: { pageNumber: 2 }, response: emptyPageResponse },
					expected: { result: { data: [], pageNumber: 2 } }
				}
			];

			runApiResultTests({ functionToTest: fetchNamespacePage, cases: resultCases });
		});

		it('propagates REST request errors', async () => {
			// Arrange:
			const requestError = new Error('REST request failed');
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(requestError);

			// Act + Assert:
			await expect(fetchNamespacePage()).rejects.toBe(requestError);
			expect(makeRequest).toHaveBeenCalledWith(`${namespacesURL}?limit=10&offset=0&sort=DESC`);
		});
	});

	describe('fetchNamespaceInfo', () => {
		it('keeps the existing namespace info stub unchanged', async () => {
			// Act:
			const result = await fetchNamespaceInfo('ignored-id');

			// Assert:
			expect(result).toBe(stubNamespaces[0]);
		});
	});
});
