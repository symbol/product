import { runAPITest } from '../test-utils/api';
import { namespaceInfoResponse, namespaceInfoResult, namespacePageResponse, namespacePageResult } from '../test-utils/namespaces';
import { fetchNamespaceInfo, fetchNamespacePage } from '@/api/namespaces';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('api/namespaces', () => {
	describe('fetchNamespacePage', () => {
		it('fetch namespace page', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				pageSize: 123
			};
			const expectedURL = 'https://explorer.backend/namespaces?limit=123&offset=246';
			const expectedResult = namespacePageResult;

			// Act & Assert:
			await runAPITest(fetchNamespacePage, searchCriteria, namespacePageResponse, expectedURL, expectedResult);
		});
	});

	describe('fetchNamespaceInfo', () => {
		it('fetch namespace info by id (name)', async () => {
			// Arrange:
			const params = 'arustest.shone';
			const expectedURL = 'https://explorer.backend/namespace/arustest.shone';
			const expectedResult = namespaceInfoResult;

			// Act & Assert:
			await runAPITest(fetchNamespaceInfo, params, namespaceInfoResponse, expectedURL, expectedResult);
		});
	});
});
