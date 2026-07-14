import { runApiTest } from '../test-utils/api';
import { healthSyncErrorResponse } from '../test-utils/health';
import { fetchBackendHealthStatus } from '@/app/api/health';

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});


describe('api/health', () => {
	describe('fetchBackendHealthStatus', () => {
		it('returns market data', async () => {
			// Arrange:
			const params = null;
			const expectedURL = 'https://explorer.backend/health';
			const expectedResult = healthSyncErrorResponse;

			// Act + Assert:
			await runApiTest(fetchBackendHealthStatus, params, healthSyncErrorResponse, expectedURL, expectedResult);
		});
	});
});
