import { accountHarvestListResponse } from '../../../../__fixtures__/api/nem/account-harvest-list';
import {
	cosignatoryAccountResponse,
	harvestingAccountResponse,
	multisigAccountResponse,
	remoteAccountResponse
} from '../../../../__fixtures__/api/nem/account-info';
import { accountListResponse } from '../../../../__fixtures__/api/nem/account-list';
import { mosaicRichListResponse } from '../../../../__fixtures__/api/nem/mosaic-rich-list';
import { cosignatoryAccount, harvestingAccount, multisigAccount, remoteAccount } from '../../../../__fixtures__/local/account';
import { accountHarvestedBlockList } from '../../../../__fixtures__/local/account-harvested-block-list';
import { accountList, accountRichList } from '../../../../__fixtures__/local/account-list';
import { error404Response, runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import {
	fetchAccountHarvestedBlockPage,
	fetchAccountInfo,
	fetchAccountInfoByPublicKey,
	fetchAccountPage
} from '@/app/variants/nem/api/accounts';

// Mocks

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

// Constants

const accountsURL = 'https://explorer.backend/accounts';
const firstPageURL = `${accountsURL}?limit=10&offset=0`;
const accountURL = 'https://explorer.backend/account';
const accountHarvestsURL = 'https://explorer.backend/account/harvests';
const mosaicRichListURL = 'https://explorer.backend/mosaic/rich/list';
const emptyPageResponse = [];
const mosaicId = 'testnamespace1.mosaic';
const harvesterAddress = harvestingAccountResponse.address;
const remark = 'Testnet harvester';
const accountWithRemarkResponse = {
	...harvestingAccountResponse,
	remark
};
const accountWithRemark = {
	...harvestingAccount,
	description: remark
};

// Tests

describe('variants/nem/api/accounts', () => {
	describe('fetchAccountPage', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the first page with the default page size',
					config: { params: {} },
					expected: { url: firstPageURL }
				},
				{
					description: 'requests the given page when "pageNumber" and "pageSize" are provided',
					config: {
						params: {
							pageNumber: 2,
							pageSize: 123
						}
					},
					expected: { url: `${accountsURL}?limit=123&offset=123` }
				},
				{
					description: 'requests the accounts sorted by height when "isLatest" is provided',
					config: {
						params: { isLatest: true }
					},
					expected: { url: `${firstPageURL}&sort_field=height` }
				},
				{
					description: 'requests only the harvesting accounts when "isActiveHarvesting" is provided',
					config: {
						params: { isActiveHarvesting: true }
					},
					expected: { url: `${firstPageURL}&is_harvesting=true` }
				},
				{
					description: 'requests the mosaic rich list when "mosaic" is provided',
					config: {
						params: { mosaic: mosaicId }
					},
					expected: { url: `${mosaicRichListURL}?limit=10&offset=0&namespace_name=${mosaicId}` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchAccountPage,
				response: emptyPageResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps the accounts',
					config: { response: accountListResponse },
					expected: {
						result: {
							data: accountList,
							pageNumber: 1
						}
					}
				},
				{
					description: 'maps the mosaic rich list when "mosaic" is provided',
					config: {
						params: { mosaic: mosaicId },
						response: mosaicRichListResponse
					},
					expected: {
						result: {
							data: accountRichList,
							pageNumber: 1
						}
					}
				}
			];

			runApiResultTests({ functionToTest: fetchAccountPage, cases: resultCases });
		});
	});

	describe('fetchAccountInfo', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the account by address',
					config: { params: cosignatoryAccountResponse.address },
					expected: { url: `${accountURL}?address=${cosignatoryAccountResponse.address}` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchAccountInfo,
				response: cosignatoryAccountResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps a cosignatory account',
					config: { response: cosignatoryAccountResponse },
					expected: { result: cosignatoryAccount }
				},
				{
					description: 'maps a multisig account',
					config: { response: multisigAccountResponse },
					expected: { result: multisigAccount }
				},
				{
					description: 'maps a remote account',
					config: { response: remoteAccountResponse },
					expected: { result: remoteAccount }
				},
				{
					description: 'maps a harvesting account',
					config: { response: harvestingAccountResponse },
					expected: { result: harvestingAccount }
				},
				{
					description: 'maps the remark to the description',
					config: { response: accountWithRemarkResponse },
					expected: { result: accountWithRemark }
				},
				{
					description: 'returns null when the account does not exist',
					config: { error: error404Response },
					expected: { result: null }
				}
			];

			runApiResultTests({ functionToTest: fetchAccountInfo, cases: resultCases });
		});
	});

	describe('fetchAccountHarvestedBlockPage', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the account harvests by address',
					config: {
						params: { address: harvesterAddress }
					},
					expected: { url: `${accountHarvestsURL}?limit=10&offset=0&address=${harvesterAddress}` }
				},
				{
					description: 'requests only the rewarded harvests when "isRewardedOnly" is provided',
					config: {
						params: {
							address: harvesterAddress,
							isRewardedOnly: true
						}
					},
					expected: { url: `${accountHarvestsURL}?limit=10&offset=0&address=${harvesterAddress}&rewardedOnly=true` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchAccountHarvestedBlockPage,
				response: emptyPageResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps the harvested blocks',
					config: { response: accountHarvestListResponse },
					expected: {
						result: {
							data: accountHarvestedBlockList,
							pageNumber: 1
						}
					}
				}
			];

			runApiResultTests({ functionToTest: fetchAccountHarvestedBlockPage, cases: resultCases });
		});
	});

	describe('fetchAccountInfoByPublicKey', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the account by public key',
					config: { params: cosignatoryAccountResponse.publicKey },
					expected: { url: `${accountURL}?publicKey=${cosignatoryAccountResponse.publicKey}` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchAccountInfoByPublicKey,
				response: cosignatoryAccountResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps the account',
					config: { response: cosignatoryAccountResponse },
					expected: { result: cosignatoryAccount }
				},
				{
					description: 'returns null when the account does not exist',
					config: { error: error404Response },
					expected: { result: null }
				}
			];

			runApiResultTests({ functionToTest: fetchAccountInfoByPublicKey, cases: resultCases });
		});
	});
});
