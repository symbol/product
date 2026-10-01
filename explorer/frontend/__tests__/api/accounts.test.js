import {
	accountHarvestedBlockPageResponse,
	accountHarvestedBlockPageResult,
	accountInfoResponse,
	accountInfoResult,
	accountPageMosaicFilterResponse,
	accountPageMosaicFilterResult,
	accountPageResponse,
	accountPageResult
} from '../test-utils/accounts';
import { runApiTest } from '../test-utils/api';
import { fetchAccountHarvestedBlockPage, fetchAccountInfo, fetchAccountInfoByPublicKey, fetchAccountPage } from '@/app/api/accounts';

// Mocks

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

// Constants

const accountAddress = 'NDHEJKXY6YK7JGRFQT2L7P3O5VMUGR4BWKQNVXXQ';
const accountPublicKey = '019B4EDDAEFA086A328EB907ECBC5ED0EABD6BBB6F3BA25B22A310CB5917A808';
const baseSearchCriteria = {
	pageNumber: 2,
	pageSize: 123
};

// Tests

describe('api/accounts', () => {
	describe('fetchAccountPage', () => {
		const runAccountPageTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const searchCriteria = { ...baseSearchCriteria, ...config.filter };
				const response = config.response || accountPageResponse;
				const expectedResult = expected.result || accountPageResult;

				// Act + Assert:
				await runApiTest(fetchAccountPage, searchCriteria, response, expected.url, expectedResult);
			});
		};

		const accountPageCases = [
			{
				description: 'fetches account page with no filter',
				config: {},
				expected: {
					url: 'https://explorer.backend/accounts?limit=123&offset=123'
				}
			},
			{
				description: 'fetches account page with mosaic filter',
				config: { 
					filter: { mosaic: 'custom.mosaic' }, 
					response: accountPageMosaicFilterResponse },
				expected: {
					url: 'https://explorer.backend/mosaic/rich/list?limit=123&offset=123&namespace_name=custom.mosaic',
					result: accountPageMosaicFilterResult
				}
			},
			{
				description: 'fetches account page with isLatest filter',
				config: { 
					filter: { isLatest: true } 
				},
				expected: {
					url: 'https://explorer.backend/accounts?limit=123&offset=123&sort_field=height'
				}
			},
			{
				description: 'fetches account page with isActiveHarvesting filter',
				config: { 
					filter: { isActiveHarvesting: true } 
				},
				expected: {
					url: 'https://explorer.backend/accounts?limit=123&offset=123&is_harvesting=true'
				}
			}
		];

		accountPageCases.forEach(({ description, config, expected }) => runAccountPageTest(description, config, expected));
	});

	describe('fetchAccountHarvestedBlockPage', () => {
		const runHarvestedBlockPageTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const searchCriteria = { ...baseSearchCriteria, address: accountAddress, ...config.filter };

				// Act + Assert:
				await runApiTest(
					fetchAccountHarvestedBlockPage,
					searchCriteria,
					accountHarvestedBlockPageResponse,
					expected.url,
					accountHarvestedBlockPageResult
				);
			});
		};

		const harvestedBlockPageCases = [
			{
				description: 'requests rewarded blocks only when isRewardedOnly is set',
				config: { 
					filter: { isRewardedOnly: true } 
				},
				expected: {
					url: `https://explorer.backend/account/harvests?limit=123&offset=123&address=${accountAddress}&rewardedOnly=true`
				}
			},
			{
				description: 'requests every harvested block when isRewardedOnly is not set',
				config: {},
				expected: {
					url: `https://explorer.backend/account/harvests?limit=123&offset=123&address=${accountAddress}`
				}
			}
		];

		harvestedBlockPageCases.forEach(({ description, config, expected }) => runHarvestedBlockPageTest(description, config, expected));
	});

	describe('fetchAccountInfo', () => {
		it('fetches account info by address', async () => {
			// Arrange:
			const expectedURL = `https://explorer.backend/account?address=${accountAddress}`;
			const expectedResult = accountInfoResult;

			// Act + Assert:
			await runApiTest(fetchAccountInfo, accountAddress, accountInfoResponse, expectedURL, expectedResult);
		});
	});

	describe('fetchAccountInfoByPublicKey', () => {
		it('fetches account info by public key', async () => {
			// Arrange:
			const expectedURL = `https://explorer.backend/account?publicKey=${accountPublicKey}`;
			const expectedResult = accountInfoResult;

			// Act + Assert:
			await runApiTest(fetchAccountInfoByPublicKey, accountPublicKey, accountInfoResponse, expectedURL, expectedResult);
		});
	});
});
