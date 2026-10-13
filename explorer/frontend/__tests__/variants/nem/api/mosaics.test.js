import { customMosaicWithLevyResponse, nativeMosaicResponse } from '../../../../__fixtures__/api/nem/mosaic-info';
import { mosaicListResponse } from '../../../../__fixtures__/api/nem/mosaic-list';
import { customMosaicWithLevy, nativeMosaic } from '../../../../__fixtures__/local/mosaic';
import { mosaicList } from '../../../../__fixtures__/local/mosaic-list';
import { error404Response, runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import { fetchMosaicInfo, fetchMosaicPage } from '@/app/variants/nem/api/mosaics';

// Mocks

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

// Constants

const mosaicsURL = 'https://explorer.backend/mosaics';
const mosaicURL = 'https://explorer.backend/mosaic';
const emptyPageResponse = [];

// Tests

describe('variants/nem/api/mosaics', () => {
	describe('fetchMosaicPage', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the first page with the default page size',
					config: { params: {} },
					expected: { url: `${mosaicsURL}?limit=10&offset=0` }
				},
				{
					description: 'requests the given page when "pageNumber" and "pageSize" are provided',
					config: {
						params: {
							pageNumber: 2,
							pageSize: 123
						}
					},
					expected: { url: `${mosaicsURL}?limit=123&offset=123` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchMosaicPage,
				response: emptyPageResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps the mosaics',
					config: { response: mosaicListResponse },
					expected: {
						result: {
							data: mosaicList,
							pageNumber: 1
						}
					}
				}
			];

			runApiResultTests({ functionToTest: fetchMosaicPage, cases: resultCases });
		});
	});

	describe('fetchMosaicInfo', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the mosaic by id',
					config: { params: customMosaicWithLevyResponse.namespaceName },
					expected: { url: `${mosaicURL}/${customMosaicWithLevyResponse.namespaceName}` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchMosaicInfo,
				response: customMosaicWithLevyResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps the native mosaic',
					config: { response: nativeMosaicResponse },
					expected: { result: nativeMosaic }
				},
				{
					description: 'maps a mosaic with a levy',
					config: { response: customMosaicWithLevyResponse },
					expected: { result: customMosaicWithLevy }
				},
				{
					description: 'returns null when the mosaic does not exist',
					config: { error: error404Response },
					expected: { result: null }
				}
			];

			runApiResultTests({ functionToTest: fetchMosaicInfo, cases: resultCases });
		});
	});
});
