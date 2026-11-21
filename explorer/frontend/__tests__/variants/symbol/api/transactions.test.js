import { transferUnconfirmedTransactionResponse } from '../../../../__fixtures__/api/symbol/transaction-list-unconfirmed';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import config from '@/app/config';
import { MESSAGE_TYPE, TRANSACTION_GROUP } from '@/app/constants';
import * as serverUtils from '@/app/utils/server';
import { fetchTransactionPage } from '@/app/variants/symbol/api/transactions';

// Mocks

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

// Constants

const unconfirmedTransactionsURL = 'https://explorer.backend/transactions/unconfirmed';
const emptyPageResponse = [];
const nativeMosaicId = '72C0212E67A08BCE';
const pendingTransfer = transferUnconfirmedTransactionResponse;
const pendingParams = { group: TRANSACTION_GROUP.UNCONFIRMED };
const senderAddress = pendingTransfer.fromAddress;
const recipientAddress = pendingTransfer.toAddress;
const nativeMosaic = { id: nativeMosaicId, name: nativeMosaicId, amount: 123 };
const transferUnconfirmedTransaction = {
	type: 'TRANSFER',
	group: TRANSACTION_GROUP.UNCONFIRMED,
	hash: pendingTransfer.transactionHash,
	signer: senderAddress,
	sender: senderAddress,
	recipient: recipientAddress,
	account: senderAddress,
	direction: null,
	timestamp: null,
	deadline: pendingTransfer.deadline,
	height: null,
	signature: pendingTransfer.signature,
	fee: null,
	amount: 123,
	value: [nativeMosaic],
	body: [{
		type: 'TRANSFER',
		sender: senderAddress,
		recipient: recipientAddress,
		mosaics: [nativeMosaic],
		message: { type: MESSAGE_TYPE.PLAIN, text: 'Hello' }
	}],
	size: pendingTransfer.size,
	version: pendingTransfer.version
};

// Tests

describe('variants/symbol/api/transactions', () => {
	beforeEach(() => {
		jest.replaceProperty(config, 'PUBLIC_NATIVE_MOSAIC_ID', nativeMosaicId);
	});

	describe('fetchTransactionPage', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the unconfirmed endpoint when the unconfirmed "group" is provided',
					config: { params: { group: TRANSACTION_GROUP.UNCONFIRMED } },
					expected: { url: unconfirmedTransactionsURL }
				}
			];

			runApiRequestTests({
				functionToTest: fetchTransactionPage,
				response: emptyPageResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps an unconfirmed transfer to the shared transaction shape',
					config: { params: pendingParams, response: [pendingTransfer] },
					expected: { result: { data: [transferUnconfirmedTransaction], pageNumber: 1 } }
				}
			];

			runApiResultTests({ functionToTest: fetchTransactionPage, cases: resultCases });
		});

		describe('error', () => {
			it('propagates unconfirmed REST failures', async () => {
				// Arrange:
				const error = new Error('Symbol node data is unavailable');
				jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

				// Act + Assert:
				await expect(fetchTransactionPage(pendingParams)).rejects.toBe(error);
			});
		});
	});
});
