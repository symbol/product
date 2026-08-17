import { accountInfoResponse, accountInfoResult } from '../test-utils/accounts';
import { error404Response } from '../test-utils/api';
import { blockInfoResponse, blockInfoResult } from '../test-utils/blocks';
import { mosaicInfoResponse, mosaicInfoResult } from '../test-utils/mosaics';
import { namespaceInfoResponse, namespaceInfoResult } from '../test-utils/namespaces';
import { transactionInfoResponse, transactionInfoResult } from '../test-utils/transactions';
import { search } from '@/app/api/search';
import * as utils from '@/app/utils/server';

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

const mockMakeRequest = responseMap => {
	const spy = jest.spyOn(utils, 'makeRequest');

	spy.mockImplementation(url => {
		const response = responseMap[url];

		if (response)
			return Promise.resolve(response);
		else
			return Promise.reject(error404Response);
	});

	return spy;
};

const runSearchTest = async (searchQuery, responseMap, expectedResult) => {
	// Arrange:
	mockMakeRequest(responseMap);

	// Act:
	const result = await search(searchQuery);

	// Assert:
	expect(result).toStrictEqual(expectedResult);
};

const runScopedSearchTest = async (searchQuery, type, responseMap, expectedResult) => {
	// Arrange:
	const spy = mockMakeRequest(responseMap);

	// Act:
	const result = await search(searchQuery, type);

	// Assert:
	expect(result).toStrictEqual(expectedResult);
	expect(spy.mock.calls.map(call => call[0])).toStrictEqual(Object.keys(responseMap));
};

describe('api/search', () => {
	it('searches block', async () => {
		// Arrange:
		const searchQuery = '1';
		const responseMap = {
			'https://explorer.backend/block/1': blockInfoResponse
		};
		const expectedResult = {
			block: blockInfoResult
		};

		// Act + Assert:
		await runSearchTest(searchQuery, responseMap, expectedResult);
	});

	it('searches block and namespace', async () => {
		// Arrange:
		const searchQuery = '1';
		const responseMap = {
			'https://explorer.backend/block/1': blockInfoResponse,
			'https://explorer.backend/namespace/1': namespaceInfoResponse
		};
		const expectedResult = {
			block: blockInfoResult,
			namespace: namespaceInfoResult
		};

		// Act + Assert:
		await runSearchTest(searchQuery, responseMap, expectedResult);
	});

	it('searches namespace', async () => {
		// Arrange:
		const searchQuery = 'namespace-name';
		const responseMap = {
			'https://explorer.backend/namespace/namespace-name': namespaceInfoResponse
		};
		const expectedResult = {
			namespace: namespaceInfoResult
		};

		// Act + Assert:
		await runSearchTest(searchQuery, responseMap, expectedResult);
	});

	it('searches namespace and mosaic', async () => {
		// Arrange:
		const searchQuery = 'namespace-name.sub-name';
		const responseMap = {
			'https://explorer.backend/mosaic/namespace-name.sub-name': mosaicInfoResponse,
			'https://explorer.backend/namespace/namespace-name.sub-name': namespaceInfoResponse
		};
		const expectedResult = {
			mosaic: mosaicInfoResult,
			namespace: namespaceInfoResult
		};

		// Act + Assert:
		await runSearchTest(searchQuery, responseMap, expectedResult);
	});

	it('searches mosaic', async () => {
		// Arrange:
		const searchQuery = 'namespace-name.sub-name';
		const responseMap = {
			'https://explorer.backend/mosaic/namespace-name.sub-name': mosaicInfoResponse
		};
		const expectedResult = {
			mosaic: mosaicInfoResult
		};

		// Act + Assert:
		await runSearchTest(searchQuery, responseMap, expectedResult);
	});

	it('searches transaction', async () => {
		// Arrange:
		const searchQuery = '89DFA7AAD61024CCB564C41239CA865221A8984EE970FBDA0F492B09E4C70691';
		const responseMap = {
			'https://explorer.backend/transaction/89DFA7AAD61024CCB564C41239CA865221A8984EE970FBDA0F492B09E4C70691': transactionInfoResponse
		};
		const expectedResult = {
			transaction: transactionInfoResult
		};

		// Act + Assert:
		await runSearchTest(searchQuery, responseMap, expectedResult);
	});

	it('searches account by address', async () => {
		// Arrange:
		const searchQuery = 'NADMEHCFJD45GPTDL4HZP2LJLZVAZRLYWYPNEMLY';
		const responseMap = {
			'https://explorer.backend/account?address=NADMEHCFJD45GPTDL4HZP2LJLZVAZRLYWYPNEMLY': accountInfoResponse
		};
		const expectedResult = {
			account: accountInfoResult
		};

		// Act + Assert:
		await runSearchTest(searchQuery, responseMap, expectedResult);
	});

	it('searches account by public key', async () => {
		// Arrange:
		const searchQuery = '63D2E7B4F5479B0BF67AC34B0656F4A265B039CE66BF6CA9BDD7C196365D8E23';
		const responseMap = {
			'https://explorer.backend/account?publicKey=63D2E7B4F5479B0BF67AC34B0656F4A265B039CE66BF6CA9BDD7C196365D8E23':
				accountInfoResponse
		};
		const expectedResult = {
			account: accountInfoResult
		};

		// Act + Assert:
		await runSearchTest(searchQuery, responseMap, expectedResult);
	});

	it('returns empty object if nothing found', async () => {
		// Arrange:
		const searchQuery = 'NADMEHCFJD45GPTDL4HZP2LJLZVAZRLYWYPNEMLY';
		const responseMap = {};
		const expectedResult = {};

		// Act + Assert:
		await runSearchTest(searchQuery, responseMap, expectedResult);
	});

	it('requests only the account when scoped to account', async () => {
		// Arrange:
		const searchQuery = 'NADMEHCFJD45GPTDL4HZP2LJLZVAZRLYWYPNEMLY';
		const responseMap = {
			'https://explorer.backend/account?address=NADMEHCFJD45GPTDL4HZP2LJLZVAZRLYWYPNEMLY': accountInfoResponse
		};
		const expectedResult = {
			account: accountInfoResult
		};

		// Act + Assert:
		await runScopedSearchTest(searchQuery, 'account', responseMap, expectedResult);
	});

	it('requests only the mosaic when scoped to mosaic', async () => {
		// Arrange:
		const searchQuery = 'namespace-name.sub-name';
		const responseMap = {
			'https://explorer.backend/mosaic/namespace-name.sub-name': mosaicInfoResponse
		};
		const expectedResult = {
			mosaic: mosaicInfoResult
		};

		// Act + Assert:
		await runScopedSearchTest(searchQuery, 'mosaic', responseMap, expectedResult);
	});

	it('requests only the block when scoped to block', async () => {
		// Arrange:
		const searchQuery = '1';
		const responseMap = {
			'https://explorer.backend/block/1': blockInfoResponse
		};
		const expectedResult = {
			block: blockInfoResult
		};

		// Act + Assert:
		await runScopedSearchTest(searchQuery, 'block', responseMap, expectedResult);
	});

	it('requests only the namespace when scoped to namespace', async () => {
		// Arrange:
		const searchQuery = 'namespace-name.sub-name';
		const responseMap = {
			'https://explorer.backend/namespace/namespace-name.sub-name': namespaceInfoResponse
		};
		const expectedResult = {
			namespace: namespaceInfoResult
		};

		// Act + Assert:
		await runScopedSearchTest(searchQuery, 'namespace', responseMap, expectedResult);
	});

	it('requests only the transaction when scoped to transaction', async () => {
		// Arrange:
		const searchQuery = '89DFA7AAD61024CCB564C41239CA865221A8984EE970FBDA0F492B09E4C70691';
		const responseMap = {
			'https://explorer.backend/transaction/89DFA7AAD61024CCB564C41239CA865221A8984EE970FBDA0F492B09E4C70691':
				transactionInfoResponse
		};
		const expectedResult = {
			transaction: transactionInfoResult
		};

		// Act + Assert:
		await runScopedSearchTest(searchQuery, 'transaction', responseMap, expectedResult);
	});

	it('requests nothing when scoped to transaction and the text cannot be a transaction hash', async () => {
		// Arrange:
		const searchQuery = '89DFA7AAD610';
		const responseMap = {};
		const expectedResult = {};

		// Act + Assert:
		await runScopedSearchTest(searchQuery, 'transaction', responseMap, expectedResult);
	});

	it('requests nothing when scoped to account and the text cannot be an account', async () => {
		// Arrange:
		const searchQuery = 'NADMEHCFJD45';
		const responseMap = {};
		const expectedResult = {};

		// Act + Assert:
		await runScopedSearchTest(searchQuery, 'account', responseMap, expectedResult);
	});
});
