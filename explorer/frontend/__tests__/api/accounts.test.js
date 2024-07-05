import {
	accountInfoResponse,
	accountInfoResult,
	accountPageMosaicFilterResponse,
	accountPageMosaicFilterResult,
	accountPageResponse,
	accountPageResult
} from '../test-utils/accounts';
import { runAPITest } from '../test-utils/api';
import { fetchAccountInfo, fetchAccountInfoByPublicKey, fetchAccountPage } from '@/api/accounts';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('api/accounts', () => {
	describe('fetchAccountPage', () => {
		it('fetch account page with no filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 2,
				pageSize: 123
			};
			const expectedURL = 'https://explorer.backend/accounts?limit=123&offset=123';
			const expectedResult = accountPageResult;

			// Act + Assert:
			await runAPITest(fetchAccountPage, searchCriteria, accountPageResponse, expectedURL, expectedResult);
		});

		it('fetch account page with mosaic filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 2,
				pageSize: 123,
				mosaic: 'custom.mosaic'
			};
			const expectedURL = 'https://explorer.backend/mosaic/rich/list?limit=123&offset=123&namespaceName=custom.mosaic';
			const expectedResult = accountPageMosaicFilterResult;

			// Act + Assert:
			await runAPITest(fetchAccountPage, searchCriteria, accountPageMosaicFilterResponse, expectedURL, expectedResult);
		});
	});

	describe('fetchAccountInfo', () => {
		it('fetch account info by address', async () => {
			// Arrange:
			const params = 'NDHEJKXY6YK7JGRFQT2L7P3O5VMUGR4BWKQNVXXQ';
			const expectedURL = 'https://explorer.backend/account?address=NDHEJKXY6YK7JGRFQT2L7P3O5VMUGR4BWKQNVXXQ';
			const expectedResult = accountInfoResult;

			// Act + Assert:
			await runAPITest(fetchAccountInfo, params, accountInfoResponse, expectedURL, expectedResult);
		});
	});

	describe('fetchAccountInfoByPublicKey', () => {
		it('fetch account info by public key', async () => {
			// Arrange:
			const params = '019B4EDDAEFA086A328EB907ECBC5ED0EABD6BBB6F3BA25B22A310CB5917A808';
			const expectedURL =
				'https://explorer.backend/account?publicKey=019B4EDDAEFA086A328EB907ECBC5ED0EABD6BBB6F3BA25B22A310CB5917A808';
			const expectedResult = accountInfoResult;

			// Act + Assert:
			await runAPITest(fetchAccountInfoByPublicKey, params, accountInfoResponse, expectedURL, expectedResult);
		});
	});
});
