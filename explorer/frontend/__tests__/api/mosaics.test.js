import { runAPITest } from '../test-utils/api';
import { mosaicInfoResponse, mosaicInfoResult, mosaicPageResponse, mosaicPageResult } from '../test-utils/mosaics';
import { fetchMosaicInfo, fetchMosaicPage } from '@/api/mosaics';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('api/mosaics', () => {
	describe('fetchMosaicPage', () => {
		it('fetch mosaic page', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				pageSize: 123
			};
			const expectedURL = 'https://explorer.backend/mosaics?limit=123&offset=246';
			const expectedResult = mosaicPageResult;

			// Act + Assert:
			await runAPITest(fetchMosaicPage, searchCriteria, mosaicPageResponse, expectedURL, expectedResult);
		});
	});

	describe('fetchMosaicInfo', () => {
		it('fetch mosaic info by id (name)', async () => {
			// Arrange:
			const params = 'arustest.shone';
			const expectedURL = 'https://explorer.backend/mosaic/arustest.shone';
			const expectedResult = mosaicInfoResult;

			// Act + Assert:
			await runAPITest(fetchMosaicInfo, params, mosaicInfoResponse, expectedURL, expectedResult);
		});
	});
});
