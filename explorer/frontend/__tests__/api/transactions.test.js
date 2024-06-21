import { runAPITest } from '../test-utils/api';
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
import { fetchTransactionInfo, fetchTransactionPage } from '@/api/transactions';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
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

			// Act & Assert:
			await runAPITest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
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

			// Act & Assert:
			await runAPITest(fetchTransactionPage, searchCriteria, transactionUnconfirmedPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page with "from" and "to" filters', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				from: senderAddress,
				to: recipientAddress
			};
			const expectedURL = `https://explorer.backend/transactions?limit=10&offset=20&senderAddress=${senderAddress}&recipientAddress=${recipientAddress}`;
			const expectedResult = transactionPageResult;

			// Act & Assert:
			await runAPITest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page for specific account with "to" filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				address: currentAddress
			};
			const expectedURL = `https://explorer.backend/transactions?limit=10&offset=20&address=${currentAddress}`;
			const expectedResult = transactionAccountPageResult;

			// Act & Assert:
			await runAPITest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page for specific account with "from" filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				from: senderAddress,
				address: currentAddress
			};
			const expectedURL = `https://explorer.backend/transactions?limit=10&offset=20&senderAddress=${senderAddress}&recipientAddress=${currentAddress}`;
			const expectedResult = transactionAccountPageResult;

			// Act & Assert:
			await runAPITest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page for specific account with "to" filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				address: currentAddress,
				to: recipientAddress
			};
			const expectedURL = `https://explorer.backend/transactions?limit=10&offset=20&senderAddress=${currentAddress}&recipientAddress=${recipientAddress}`;
			const expectedResult = transactionAccountPageResult;

			// Act & Assert:
			await runAPITest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});
	});

	describe('fetchTransactionInfo', () => {
		it('fetch transaction info by hash', async () => {
			// Arrange:
			const params = '596E3EC601470D9A5FDF966833566390C13D5DB7D24F5C9C712AC2056D7AE255';
			const expectedURL = 'https://explorer.backend/transaction/596E3EC601470D9A5FDF966833566390C13D5DB7D24F5C9C712AC2056D7AE255';
			const expectedResult = transactionInfoResult;

			// Act & Assert:
			await runAPITest(fetchTransactionInfo, params, transactionInfoResponse, expectedURL, expectedResult);
		});

		it('fetch unsupported transaction info by hash', async () => {
			// Arrange:
			const params = '596E3EC601470D9A5FDF966833566390C13D5DB7D24F5C9C712AC2056D7AE255';
			const expectedURL = 'https://explorer.backend/transaction/596E3EC601470D9A5FDF966833566390C13D5DB7D24F5C9C712AC2056D7AE255';
			const expectedResult = unsupportedTransactionInfoResult;

			// Act & Assert:
			await runAPITest(fetchTransactionInfo, params, unsupportedTransactionInfoResponse, expectedURL, expectedResult);
		});
	});
});
