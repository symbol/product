import { runAPITest } from '../test-utils/api';
import { transactionInfoResponse, transactionInfoResult, transactionPageResponse, transactionPageResult } from '../test-utils/transactions';
import { fetchTransactionInfo, fetchTransactionPage } from '@/api/transactions';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('api/transactions', () => {
	describe('fetchTransactionPage', () => {
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
			const expectedResult = transactionPageResult;

			// Act & Assert:
			await runAPITest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page with "from" and "to" filters', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				from: 'test-sender-address',
				to: 'test-recipient-address'
			};
			const expectedURL =
				'https://explorer.backend/transactions?limit=10&offset=20&senderAddress=test-sender-address&recipientAddress=test-recipient-address';
			const expectedResult = transactionPageResult;

			// Act & Assert:
			await runAPITest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page for specific account with "from" filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				from: 'test-sender-address',
				address: 'test-current-address'
			};
			const expectedURL =
				'https://explorer.backend/transactions?limit=10&offset=20&senderAddress=test-sender-address&recipientAddress=test-current-address';
			const expectedResult = transactionPageResult;

			// Act & Assert:
			await runAPITest(fetchTransactionPage, searchCriteria, transactionPageResponse, expectedURL, expectedResult);
		});

		it('fetch transaction page for specific account with "to" filter', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 3,
				address: 'test-current-address',
				to: 'test-recipient-address'
			};
			const expectedURL =
				'https://explorer.backend/transactions?limit=10&offset=20&senderAddress=test-current-address&recipientAddress=test-recipient-address';
			const expectedResult = transactionPageResult;

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
	});
});
