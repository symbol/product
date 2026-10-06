import { runApiTest } from '../../../test-utils/api';
import { healthSyncErrorResponse } from '../../../test-utils/health';
import { fetchBackendHealthStatus, healthConfig } from '@/app/variants/nem/api/health';

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});


describe('variants/nem/api/health', () => {
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

	it('disables unavailable-request warnings for NEM', () => {
		// Act + Assert:
		expect(healthConfig).toEqual({ isUnavailableWarningEnabled: false });
	});
});
