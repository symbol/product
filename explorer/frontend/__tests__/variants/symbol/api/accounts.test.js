import { accountListResponse } from '../../../../__fixtures__/api/symbol/account-list';
import { accountList } from '../../../../__fixtures__/local/symbol/account-list';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import config from '@/app/config';
import { formatAccountCSV } from '@/app/utils/common';
import * as serverUtils from '@/app/utils/server';
import {
	fetchAccountHarvestedBlockPage,
	fetchAccountInfo,
	fetchAccountInfoByPublicKey,
	fetchAccountPage
} from '@/app/variants/symbol/api/accounts';
import { stubAccounts, stubHarvestedBlocks } from '@/app/variants/symbol/api/fixtures';

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

const SYMBOL_API_BASE_URL = 'https://explorer.backend/api/symbol';
beforeEach(() => {
	config.PUBLIC_API_BASE_URL = SYMBOL_API_BASE_URL;
});

describe('variants/symbol/api/accounts', () => {
	describe('fetchAccountPage', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the default page',
					config: { params: {} },
					expected: { url: `${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0` }
				},
				{
					description: 'requests the next page with the requested size',
					config: { params: { pageNumber: 2, pageSize: 25 } },
					expected: { url: `${SYMBOL_API_BASE_URL}/accounts?limit=25&offset=25` }
				},
				{
					description: 'maps the latest filter',
					config: { params: { isLatest: true } },
					expected: { url: `${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0&sort_field=HEIGHT` }
				},
				{
					description: 'maps the active harvesting filter',
					config: { params: { isActiveHarvesting: true } },
					expected: { url: `${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0&is_harvesting=true` }
				},
				{
					description: 'requests active harvesting accounts sorted by height when both filters are enabled',
					config: { params: { isLatest: true, isActiveHarvesting: true } },
					expected: { url: `${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0&sort_field=HEIGHT&is_harvesting=true` }
				},
				{
					description: 'removes cleared filters',
					config: { params: { isLatest: false, isActiveHarvesting: false } },
					expected: { url: `${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0` }
				},
				{
					description: 'removes undefined filters',
					config: { params: { isLatest: undefined, isActiveHarvesting: undefined } },
					expected: { url: `${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0` }
				},
				{
					description: 'maps a canonical mosaic ID to balance sorting',
					config: { params: { mosaic: '1234567890ABCDEF' } },
					expected: {
						url: `${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0&sort_field=BALANCE&mosaic_id=1234567890ABCDEF`
					}
				}
			];

			runApiRequestTests({ functionToTest: fetchAccountPage, response: [], cases: requestCases });
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps the complete account list DTOs',
					config: { response: accountListResponse },
					expected: { result: { data: accountList, pageNumber: 1 } }
				},
				{
					description: 'maps 0.29 to 29 percent without floating point artifacts',
					config: { response: [{ ...accountListResponse[0], importance: 0.29 }] },
					expected: { result: { data: [{ ...accountList[0], importance: 29 }], pageNumber: 1 } }
				},
				{
					description: 'preserves a small importance ratio when scaling to a percentage',
					config: { response: [{ ...accountListResponse[0], importance: 0.0000001 }] },
					expected: { result: { data: [{ ...accountList[0], importance: 0.00001 }], pageNumber: 1 } }
				},
				{
					description: 'preserves significant digits when scaling importance to a percentage',
					config: { response: [{ ...accountListResponse[0], importance: 0.1234567890123456 }] },
					expected: { result: { data: [{ ...accountList[0], importance: 12.34567890123456 }], pageNumber: 1 } }
				},
				{
					description: 'returns a normal empty page',
					config: { response: [] },
					expected: { result: { data: [], pageNumber: 1 } }
				},
				{
					description: 'preserves the next page number',
					config: { params: { pageNumber: 2, pageSize: 25 }, response: accountListResponse },
					expected: { result: { data: accountList, pageNumber: 2 } }
				}
			];

			runApiResultTests({ functionToTest: fetchAccountPage, cases: resultCases });
		});

		it('does not mutate the caller search parameters', async () => {
			// Arrange:
			const searchParams = Object.freeze({
				pageNumber: 2,
				pageSize: 25,
				isLatest: true,
				isActiveHarvesting: true,
				mosaic: '1234567890ABCDEF'
			});
			const expectedSearchParams = { ...searchParams };
			jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

			// Act:
			await fetchAccountPage(searchParams);

			// Assert:
			expect(searchParams).toEqual(expectedSearchParams);
		});

		it.each([
			['HTTP 400', { response: { data: { status: 400 } } }],
			['HTTP 503', { response: { data: { status: 503 } } }],
			['HTTP 500', { response: { data: { status: 500 } } }],
			['a communication error', new Error('network failure')],
			['a timeout', Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })]
		])('propagates %s from Explorer REST', async (_description, error) => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchAccountPage()).rejects.toBe(error);
			expect(makeRequest).toHaveBeenCalledTimes(1);
		});

		it('keeps the account list row compatible with CSV output', async () => {
			// Arrange:
			jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([
				{
					address: 'TACCOUNTADDRESS',
					publicKey: null,
					accountType: 'main',
					importance: 0.29,
					balance: 0,
					namespaces: [],
					mosaics: [],
					description: null,
					isHarvestingActive: false,
					isMultisig: false
				}
			]);

			// Act:
			const { data } = await fetchAccountPage();
			const csvRow = formatAccountCSV(data[0], key => key);

			// Assert:
			expect(csvRow).toEqual({
				table_field_address: 'TACCOUNTADDRESS',
				table_field_balance: 0,
				table_field_importance: 29,
				table_field_isMultisig: 'value_false',
				table_field_isHarvestingActive: 'value_false',
				table_field_description: null
			});
		});
	});

	describe('existing account functions', () => {
		it('returns the existing account info stub', async () => {
			// Arrange:
			const address = 'TACCOUNTADDRESS';

			// Act:
			const accountInfo = await fetchAccountInfo(address);

			// Assert:
			expect(accountInfo).toBe(stubAccounts[0]);
		});

		it('returns the existing public-key lookup stub', async () => {
			// Arrange:
			const publicKey = 'AB'.repeat(32);

			// Act:
			const accountInfo = await fetchAccountInfoByPublicKey(publicKey);

			// Assert:
			expect(accountInfo).toBe(stubAccounts[0]);
		});

		it('returns the first harvested-block stub page by default', async () => {
			// Arrange:
			const expectedPage = { data: stubHarvestedBlocks, pageNumber: 1 };

			// Act:
			const harvestedBlockPage = await fetchAccountHarvestedBlockPage();

			// Assert:
			expect(harvestedBlockPage).toEqual(expectedPage);
		});

		it('returns an empty subsequent harvested-block stub page', async () => {
			// Arrange:
			const searchParams = { pageNumber: 2 };

			// Act:
			const harvestedBlockPage = await fetchAccountHarvestedBlockPage(searchParams);

			// Assert:
			expect(harvestedBlockPage).toEqual({ data: [], pageNumber: 2 });
		});
	});
});
