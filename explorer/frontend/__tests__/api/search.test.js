import { accountInfoResponse, accountInfoResult } from '../test-utils/accounts';
import { error404Response } from '../test-utils/api';
import { blockInfoResponse, blockInfoResult } from '../test-utils/blocks';
import { mosaicInfoResponse, mosaicInfoResult } from '../test-utils/mosaics';
import { namespaceInfoResponse, namespaceInfoResult } from '../test-utils/namespaces';
import { transactionInfoResponse, transactionInfoResult } from '../test-utils/transactions';
import { search } from '@/api/search';
import * as utils from '@/utils/server';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

const runSearchTest = async (searchQuery, responseMap, expectedResult) => {
	// Arrange:
	const spy = jest.spyOn(utils, 'makeRequest');

	spy.mockImplementation(url => {
		const response = responseMap[url];

		if (response)
			return Promise.resolve(response);
		else
			return Promise.reject(error404Response);
	});

	// Act:
	const result = await search(searchQuery);

	// Assert:
	expect(result).toStrictEqual(expectedResult);
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
});
