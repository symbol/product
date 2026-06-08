import { runApiTest } from '../test-utils/api';
import { healthSyncErrorResponse } from '../test-utils/health';
import { fetchBackendHealthStatus } from '@/api/health';
import config from '@/config';
import * as utils from '@/utils/server';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});


describe('api/health', () => {
	const originalConfig = {
		BACKEND_HEALTH_CHECK_ENABLED: config.BACKEND_HEALTH_CHECK_ENABLED
	};

	afterEach(() => {
		Object.assign(config, originalConfig);
	});

	describe('fetchBackendHealthStatus', () => {
		it('returns market data', async () => {
			// Arrange:
			config.BACKEND_HEALTH_CHECK_ENABLED = true;
			const params = null;
			const expectedURL = 'https://explorer.backend/health';
			const expectedResult = healthSyncErrorResponse;

			// Act + Assert:
			await runApiTest(fetchBackendHealthStatus, params, healthSyncErrorResponse, expectedURL, expectedResult);
		});

		it('skips backend health requests when disabled by variant config', async () => {
			// Arrange:
			config.BACKEND_HEALTH_CHECK_ENABLED = false;
			const spy = jest.spyOn(utils, 'makeRequest');

			// Act:
			const result = await fetchBackendHealthStatus();

			// Assert:
			expect(spy).not.toHaveBeenCalled();
			expect(result).toBeNull();
		});
	});
});
