import config from '@/app/config';
import * as serverUtils from '@/app/utils/server';
import { fetchBackendHealthStatus, healthConfig } from '@/app/variants/symbol/api/health';

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

describe('variants/symbol/api/health', () => {
	beforeEach(() => {
		config.PUBLIC_API_BASE_URL = 'https://explorer.backend/api/symbol';
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('enables unavailable-request warnings for Symbol', () => {
		// Act + Assert:
		expect(healthConfig).toEqual({ isUnavailableWarningEnabled: true });
	});

	it('returns the complete health response without coercing values', async () => {
		// Arrange:
		const health = {
			isHealthy: false,
			dbUp: false,
			backendSynced: false,
			lastDBHeight: null,
			lastDBSyncedAt: null,
			finalizedHeight: null,
			status: 'degraded',
			errors: [{ type: 'database', message: 'database unavailable' }]
		};
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(health);

		// Act:
		const result = await fetchBackendHealthStatus();

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith('https://explorer.backend/api/symbol/health');
		expect(result).toBe(health);
	});

	it('preserves a null health response', async () => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(null);

		// Act:
		const result = await fetchBackendHealthStatus();

		// Assert:
		expect(result).toBeNull();
	});

	it('propagates communication failures', async () => {
		// Arrange:
		const error = Error('network unavailable');
		jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

		// Act + Assert:
		await expect(fetchBackendHealthStatus()).rejects.toBe(error);
	});
});
