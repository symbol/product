import {
	namespaceResponse,
	namespaceWithMosaicsResponse,
	nativeNamespaceResponse
} from '../../../../__fixtures__/api/nem/namespace-info';
import { namespaceListResponse } from '../../../../__fixtures__/api/nem/namespace-list';
import { namespace, namespaceWithMosaics, nativeNamespace } from '../../../../__fixtures__/local/namespace';
import { namespaceList } from '../../../../__fixtures__/local/namespace-list';
import { error404Response, runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import { fetchNamespaceInfo, fetchNamespacePage } from '@/app/variants/nem/api/namespaces';

// Mocks

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

// Constants

const namespacesURL = 'https://explorer.backend/namespaces';
const namespaceURL = 'https://explorer.backend/namespace';
const emptyPageResponse = [];

// Tests

describe('variants/nem/api/namespaces', () => {
	describe('fetchNamespacePage', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the first page with the default page size',
					config: { params: {} },
					expected: { url: `${namespacesURL}?limit=10&offset=0` }
				},
				{
					description: 'requests the given page when "pageNumber" and "pageSize" are provided',
					config: {
						params: {
							pageNumber: 2,
							pageSize: 123
						}
					},
					expected: { url: `${namespacesURL}?limit=123&offset=123` }
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
					description: 'maps the namespaces',
					config: { response: namespaceListResponse },
					expected: {
						result: {
							data: namespaceList,
							pageNumber: 1
						}
					}
				}
			];

			runApiResultTests({ functionToTest: fetchNamespacePage, cases: resultCases });
		});
	});

	describe('fetchNamespaceInfo', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the namespace by id',
					config: { params: namespaceWithMosaicsResponse.rootNamespace },
					expected: { url: `${namespaceURL}/${namespaceWithMosaicsResponse.rootNamespace}` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchNamespaceInfo,
				response: namespaceWithMosaicsResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps the native namespace',
					config: { response: nativeNamespaceResponse },
					expected: { result: nativeNamespace }
				},
				{
					description: 'maps a namespace with sub-namespaces',
					config: { response: namespaceWithMosaicsResponse },
					expected: { result: namespaceWithMosaics }
				},
				{
					description: 'maps a namespace without mosaics',
					config: { response: namespaceResponse },
					expected: { result: namespace }
				},
				{
					description: 'returns null when the namespace does not exist',
					config: { error: error404Response },
					expected: { result: null }
				}
			];

			runApiResultTests({ functionToTest: fetchNamespaceInfo, cases: resultCases });
		});
	});
});
