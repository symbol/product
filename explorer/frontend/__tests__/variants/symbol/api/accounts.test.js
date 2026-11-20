import {
	accountInfoResponse,
	accountInfoWithoutPublicKeyResponse,
	mainAccountInfoResponse,
	multisigAccountInfoResponse,
	remoteAccountInfoResponse
} from '../../../../__fixtures__/api/symbol/account-info';
import {
	accountInfo,
	accountInfoWithoutPublicKey,
	mainAccountInfo,
	multisigAccountInfo,
	remoteAccountInfo
} from '../../../../__fixtures__/local/symbol/account';
import { error404Response, runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import config from '@/app/config';
import * as serverUtils from '@/app/utils/server';
import { fetchAccountInfo, fetchAccountInfoByPublicKey } from '@/app/variants/symbol/api/accounts';

// Mocks

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

// Constants

const symbolApiBaseURL = 'https://explorer.backend/api/symbol';
const accountURL = `${symbolApiBaseURL}/account`;
const accountAddress = accountInfoResponse.address;
const accountPublicKey = accountInfoResponse.publicKey;
const error400Response = { response: { data: { status: 400 } } };

const accountInfoResultCases = [
	{
		description: 'maps the account including formatted mosaic amounts and importance percentage',
		config: { response: accountInfoResponse },
		expected: { result: accountInfo }
	},
	{
		description: 'converts an importance ratio of 0.29 to an exact percentage',
		config: { response: { ...accountInfoResponse, importance: 0.29 } },
		expected: { result: { ...accountInfo, importance: 29 } }
	},
	{
		description: 'converts a small scientific-notation importance ratio to a percentage',
		config: { response: { ...accountInfoResponse, importance: 0.0000001 } },
		expected: { result: { ...accountInfo, importance: 0.00001 } }
	},
	{
		description: 'preserves the significant digits of an importance ratio',
		config: { response: { ...accountInfoResponse, importance: 0.1234567890123456 } },
		expected: { result: { ...accountInfo, importance: 12.34567890123456 } }
	},
	{
		description: 'preserves an unset public key and nullable detail fields',
		config: { response: accountInfoWithoutPublicKeyResponse },
		expected: { result: accountInfoWithoutPublicKey }
	},
	{
		description: 'maps the linked account from a main account',
		config: { response: mainAccountInfoResponse },
		expected: { result: mainAccountInfo }
	},
	{
		description: 'maps the main account from a remote account',
		config: { response: remoteAccountInfoResponse },
		expected: { result: remoteAccountInfo }
	},
	{
		description: 'maps multisig relationships and the minimum cosignatory count',
		config: { response: multisigAccountInfoResponse },
		expected: { result: multisigAccountInfo }
	},
	{
		description: 'returns null when REST rejects an invalid query with 400',
		config: { error: error400Response },
		expected: { result: null }
	},
	{
		description: 'returns null when REST reports an account not found with 404',
		config: { error: error404Response },
		expected: { result: null }
	}
];

describe('variants/symbol/api/accounts', () => {
	beforeEach(() => {
		config.PUBLIC_API_BASE_URL = symbolApiBaseURL;
	});

	describe('fetchAccountInfo', () => {
		describe('request', () => {
			runApiRequestTests({
				functionToTest: fetchAccountInfo,
				response: accountInfoResponse,
				cases: [
					{
						description: 'requests the account by address',
						config: { params: accountAddress },
						expected: { url: `${accountURL}?address=${accountAddress}` }
					}
				]
			});
		});

		describe('result', () => {
			runApiResultTests({ functionToTest: fetchAccountInfo, cases: accountInfoResultCases });
		});
	});

	describe('fetchAccountInfoByPublicKey', () => {
		describe('request', () => {
			runApiRequestTests({
				functionToTest: fetchAccountInfoByPublicKey,
				response: accountInfoResponse,
				cases: [
					{
						description: 'requests the account by public key',
						config: { params: accountPublicKey },
						expected: { url: `${accountURL}?publicKey=${accountPublicKey}` }
					}
				]
			});
		});

		describe('result', () => {
			runApiResultTests({ functionToTest: fetchAccountInfoByPublicKey, cases: accountInfoResultCases });
		});
	});

	describe.each([
		['address lookup', fetchAccountInfo, accountAddress],
		['public key lookup', fetchAccountInfoByPublicKey, accountPublicKey]
	])('%s failure handling', (_description, functionToTest, parameter) => {
		it.each([
			['a 503 service error', { response: { data: { status: 503 } } }],
			['a communication failure', new Error('Network Error')]
		])('propagates %s', async (_errorDescription, error) => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(functionToTest(parameter)).rejects.toBe(error);
			expect(makeRequest).toHaveBeenCalledTimes(1);
		});
	});
});
