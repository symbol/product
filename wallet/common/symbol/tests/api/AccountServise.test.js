import { AccountService } from '../../src/api/AccountService';
import { accountInfoResponse } from '../__fixtures__/api/account-info-response';
import { 
	accountMultisigCosignerResponse, 
	accountMultisigResponse 
} from '../__fixtures__/api/account-multisig-response';
import { 
	accountInfoCosigner, 
	accountInfoMultisig, 
	accountInfoNonMultisig, 
	multisigInfo, 
	multisigInfoCosigner 
} from '../__fixtures__/local/account';
import { mosaicInfos } from '../__fixtures__/local/mosaic';
import { networkProperties } from '../__fixtures__/local/network';
import { currentAccount } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
import { ApiError } from 'wallet-common-core';


const mockMakeRequest = jest.fn();
const mockApi = {
	mosaic: {
		fetchMosaicInfos: jest.fn()
	},
	namespace: {
		fetchAccountNamespaces: jest.fn()
	}
};

describe('AccountService', () => {
	let accountService;
	const {address} = currentAccount;

	beforeEach(() => {
		accountService = new AccountService({
			api: mockApi,
			makeRequest: mockMakeRequest
		});
	});

	describe('fetchAccountInfo', () => {
		const runFetchAccountInfoTest = async ({
			accountResponse,
			multisigInfoReturnValue,
			shouldThrowMultisigRequest,
			expectedResult
		}) => {
			// Arrange:
			mockMakeRequest.mockResolvedValueOnce(accountResponse);
			mockApi.mosaic.fetchMosaicInfos.mockResolvedValueOnce(mosaicInfos);
			mockApi.namespace.fetchAccountNamespaces.mockResolvedValueOnce([]);

			if (shouldThrowMultisigRequest) 
				accountService.fetchMultisigInfo = jest.fn().mockRejectedValueOnce(new ApiError());
			else 
				accountService.fetchMultisigInfo = jest.fn().mockResolvedValueOnce(multisigInfoReturnValue);
            

			// Act:
			const result = await accountService.fetchAccountInfo(networkProperties, address);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
			expect(mockMakeRequest).toHaveBeenCalledWith(`${networkProperties.nodeUrl}/accounts/${address}`);
			expect(mockApi.mosaic.fetchMosaicInfos)
				.toHaveBeenCalledWith(networkProperties, accountResponse.account.mosaics.map(mosaic => mosaic.id));
			expect(accountService.fetchMultisigInfo).toHaveBeenCalledWith(networkProperties, address);
			expect(mockApi.namespace.fetchAccountNamespaces).toHaveBeenCalledWith(networkProperties, address);
		};
        
		it('fetches and formats account info for a non-multisig account', async () => {
			// Act & Assert:
			await runFetchAccountInfoTest({
				accountResponse: accountInfoResponse,
				shouldThrowMultisigRequest: true,
				expectedResult: accountInfoNonMultisig
			});
		});

		it('fetches and formats account info for a multisig account', async () => {
			// Act & Assert:
			await runFetchAccountInfoTest({
				accountResponse: accountInfoResponse,
				multisigInfoReturnValue: multisigInfo,
				shouldThrowMultisigRequest: false,
				expectedResult: accountInfoMultisig
			});
		});

		it('fetches and formats account info for a cosigner account', async () => {
			// Act & Assert:
			await runFetchAccountInfoTest({
				accountResponse: accountInfoResponse,
				multisigInfoReturnValue: multisigInfoCosigner,
				shouldThrowMultisigRequest: false,
				expectedResult: accountInfoCosigner
			});
		});
	});

	describe('fetchAccountBalance', () => {
		it('fetches and formats account balance', async () => {
			// Arrange:
			const expectedBalance = 7270485345.948776;
			mockMakeRequest.mockResolvedValueOnce(accountInfoResponse);

			// Act:
			const result = await accountService.fetchAccountBalance(networkProperties, address);

			// Assert:
			expect(result).toBe(expectedBalance);
			expect(mockMakeRequest).toHaveBeenCalledWith(`${networkProperties.nodeUrl}/accounts/${address}`);
		});
	});

	describe('fetchMultisigInfo', () => {
		const runFetchMultisigInfoTest = async (response, expectedResult) => {
			// Arrange:
			mockMakeRequest.mockResolvedValueOnce(response);

			// Act:
			const result = await accountService.fetchMultisigInfo(networkProperties, address);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
			expect(mockMakeRequest).toHaveBeenCalledWith(`${networkProperties.nodeUrl}/account/${address}/multisig`);
		};
        
		it('fetches and formats multisig info for a multisig account', async () => {
			// Act & Assert:
			await runFetchMultisigInfoTest(accountMultisigResponse, multisigInfo);
		});

		it('fetches and formats multisig info for a cosigner account', async () => {
			// Act & Assert:
			await runFetchMultisigInfoTest(accountMultisigCosignerResponse, multisigInfoCosigner);
		});
	});
});
