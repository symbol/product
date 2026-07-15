import { runApiTest } from '../test-utils/api';
import {
	transactionAccountPageResult,
	transactionInfoResponse,
	transactionInfoResult,
	transactionPageResponse,
	transactionPageResult,
	transactionUnconfirmedPageResponse,
	transactionUnconfirmedPageResult,
	unsupportedTransactionInfoResponse,
	unsupportedTransactionInfoResult
} from '../test-utils/transactions';
import { fetchTransactionInfo, fetchTransactionPage } from '@/app/api/transactions';
import * as serverUtils from '@/app/utils/server';

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

describe('api/transactions', () => {
	describe('fetchTransactionPage', () => {
		// Arrange:
		const currentAddress = 'NBFQ6XFBKB3DHJCFDKCMJI5MZ53HFQ56AKDLY4JK';
		const senderAddress = 'FROM000BKB3DHJCFDKCMJI5MZ53HFQ56AKDLY000';
		const recipientAddress = 'TO00000BKB3DHJCFDKCMJI5MZ53HFQ56AKDLY001';

		it('fetch transaction page', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				pageSize: 123
			};
			const expectedURL = 'https://explorer.backend/transactions?limit=123&offset=246';
			const expectedResult = transactionPageResult;

			// Act + Assert:
			await runApiTest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page with "unconfirmed" filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				pageSize: 123,
				group: 'unconfirmed'
			};
			const expectedURL = 'https://explorer.backend/transactions/unconfirmed?limit=123&offset=246';
			const expectedResult = transactionUnconfirmedPageResult;

			// Act + Assert:
			await runApiTest(fetchTransactionPage, searchCriteria, transactionUnconfirmedPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page with "from" and "to" filters', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				from: senderAddress,
				to: recipientAddress
			};
			// eslint-disable-next-line max-len
			const expectedURL = `https://explorer.backend/transactions?limit=10&offset=20&senderAddress=${senderAddress}&recipientAddress=${recipientAddress}`;
			const expectedResult = transactionPageResult;

			// Act + Assert:
			await runApiTest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page with "types" filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				types: 'MULTISIG_ACCOUNT_MODIFICATION'
			};
			// eslint-disable-next-line max-len
			const expectedURL = 'https://explorer.backend/transactions?limit=10&offset=20&transactionTypes=MULTISIG_ACCOUNT_MODIFICATION';
			const expectedResult = transactionPageResult;

			// Act + Assert:
			await runApiTest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page for specific account with "to" filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				address: currentAddress
			};
			const expectedURL = `https://explorer.backend/transactions?limit=10&offset=20&address=${currentAddress}`;
			const expectedResult = transactionAccountPageResult;

			// Act + Assert:
			await runApiTest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page for specific account with "from" filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				from: senderAddress,
				address: currentAddress
			};
			// eslint-disable-next-line max-len
			const expectedURL = `https://explorer.backend/transactions?limit=10&offset=20&senderAddress=${senderAddress}&recipientAddress=${currentAddress}`;
			const expectedResult = transactionAccountPageResult;

			// Act + Assert:
			await runApiTest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page for specific account with "to" filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				address: currentAddress,
				to: recipientAddress
			};
			// eslint-disable-next-line max-len
			const expectedURL = `https://explorer.backend/transactions?limit=10&offset=20&senderAddress=${currentAddress}&recipientAddress=${recipientAddress}`;
			const expectedResult = transactionAccountPageResult;

			// Act + Assert:
			await runApiTest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});
	});

	describe('fetchTransactionInfo', () => {
		it('fetch transaction info by hash', async () => {
			// Arrange:
			const params = '596E3EC601470D9A5FDF966833566390C13D5DB7D24F5C9C712AC2056D7AE255';
			const expectedURL = 'https://explorer.backend/transaction/596E3EC601470D9A5FDF966833566390C13D5DB7D24F5C9C712AC2056D7AE255';
			const expectedResult = transactionInfoResult;

			// Act + Assert:
			await runApiTest(fetchTransactionInfo, params, transactionInfoResponse, expectedURL, expectedResult);
		});

		it('fetch unsupported transaction info by hash', async () => {
			// Arrange:
			const params = '596E3EC601470D9A5FDF966833566390C13D5DB7D24F5C9C712AC2056D7AE255';
			const expectedURL = 'https://explorer.backend/transaction/596E3EC601470D9A5FDF966833566390C13D5DB7D24F5C9C712AC2056D7AE255';
			const expectedResult = unsupportedTransactionInfoResult;

			// Act + Assert:
			await runApiTest(fetchTransactionInfo, params, unsupportedTransactionInfoResponse, expectedURL, expectedResult);
		});

		it('fetch account key link info with remote account address from transaction payload', async () => {
			// Arrange:
			const hash = '0235992BAA8C323ED0D0E74EE6CE97F635D0997493324F01FAB4B470088C6C0F';
			const transactionURL = `https://explorer.backend/transaction/${hash}`;
			const remotePublicKey = '64F0C867C52E8D3F7FE478854DBB197646D06041CC16B56595C03A217AF6564B';
			const expectedRemoteAddress = 'NA6N267O7JIRQY5WQTM4IFUFRMOUJDB5OAOQ777N';
			const transactionResponse = {
				deadline: '2015-03-30 08:31:57',
				embeddedTransactions: null,
				fee: 6.0,
				fromAddress: 'NALICE7GX3PF3WAOWVLXFOQ4ZMOBP7GUMNB2RCYQ',
				height: 2,
				signature:
					'84DD349E10D4669F3C727EE7F58DA8077D85455699E95536BBD0255C8708DAB5FD5C008676E29E3486F079927685218EE49F1D37'
					+ '3FD95F0769B33F06F75B030A',
				timestamp: '2015-03-29 20:31:57',
				toAddress: null,
				transactionHash: hash,
				transactionType: 'ACCOUNT_KEY_LINK',
				value: [{ mode: 1, remoteAccount: remotePublicKey, remoteAddress: expectedRemoteAddress }]
			};
			const makeRequestSpy = jest.spyOn(serverUtils, 'makeRequest');
			makeRequestSpy.mockResolvedValueOnce(transactionResponse);

			// Act:
			const result = await fetchTransactionInfo(hash);

			// Assert:
			expect(makeRequestSpy).toHaveBeenCalledTimes(1);
			expect(makeRequestSpy).toHaveBeenNthCalledWith(1, transactionURL);
			expect(result.body[0]).toEqual(expect.objectContaining({
				type: 'ACCOUNT_KEY_LINK',
				keyLinkAction: 1,
				publicKey: remotePublicKey,
				remoteAccount: expectedRemoteAddress
			}));
		});
	});
});
