import { healthWithSyncErrorResponse } from '../../../../__fixtures__/api/nem/health';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import { fetchBackendHealthStatus } from '@/app/variants/nem/api/health';

// Mocks

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

// Constants

const healthURL = 'https://explorer.backend/health';

// Tests

describe('variants/nem/api/health', () => {
	describe('fetchBackendHealthStatus', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the backend health',
					config: {},
					expected: { url: healthURL }
				}
			];

			runApiRequestTests({
				functionToTest: fetchBackendHealthStatus,
				response: healthWithSyncErrorResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'returns the exact response with no changes',
					config: { response: healthWithSyncErrorResponse },
					expected: { result: healthWithSyncErrorResponse }
				}
			];

			runApiResultTests({ functionToTest: fetchBackendHealthStatus, cases: resultCases });
		});
	});
});
