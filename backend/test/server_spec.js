const nemController = require('../src/controllers/nem');
const server = require('../src/server');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const supertest = require('supertest');

describe('POST /claim/xem', () => {
	let getAccountBalanceStub = {};
	let getUnconfirmedTransactionsStub = [];
	let transferXemStub = {};
	let mockFaucetAccountBalance = {};
	let mockRequestAccountBalance = {};

	beforeEach(() => {
		getAccountBalanceStub = stub(nemController, 'getAccountBalance');
		getUnconfirmedTransactionsStub = stub(nemController, 'getUnconfirmedTransactions');
		transferXemStub = stub(nemController, 'transferXem');

		mockFaucetAccountBalance = {
			address: process.env.NEM_FAUCET_ADDRESS,
			balance: 10000000000
		};

		mockRequestAccountBalance = {
			address: 'TALICE5VF6J5FYMTCB7A3QG6OIRDRUXDWJGFVXNW',
			balance: 1000000
		};

		getAccountBalanceStub
			.withArgs(mockFaucetAccountBalance.address)
			.returns(Promise.resolve(mockFaucetAccountBalance));

		getUnconfirmedTransactionsStub.returns(Promise.resolve([]));

		getAccountBalanceStub.returns(Promise.resolve(mockRequestAccountBalance));
	});

	afterEach(restore);

	it('responds 200', async () => {
		// Arrange:
		const mockTransferXemResult = {
			code: 1,
			type: 1,
			transactionHash: {
				data: 'c1786437336da077cd572a27710c40c378610e8d33880bcb7bdb0a42e3d35586'
			}
		};

		transferXemStub.returns(Promise.resolve(mockTransferXemResult));

		// Act:
		const response = await supertest(server)
			.post('/claim/xem')
			.send({
				address: mockRequestAccountBalance.address,
				amount: 10
			})
			.set('Accept', 'application/json');

		// Assert:
		expect(response.status).to.be.equal(200);
		expect(response.body).to.be.deep.equal({
			code: 1,
			type: 1,
			transactionHash: mockTransferXemResult.transactionHash.data,
			amount: 10,
			receiptAddress: mockRequestAccountBalance.address
		});
	});

	it('responds 400 by validation failure', async () => {
		// Arrange:
		const requestOverPayoutAmount = 100000;

		// Act:
		const response = await supertest(server)
			.post('/claim/xem')
			.send({ address: mockRequestAccountBalance.address, amount: requestOverPayoutAmount })
			.set('Accept', 'application/json');

		// Assert:
		expect(response.status).to.be.equal(400);
		expect(response.body).to.be.deep.equal({
			code: 'BadRequest',
			message: 'Faucet balance not enough to pay out'
		});
	});

	it('responds 500 given invalid address', async () => {
		// Arrange + Act:
		const response = await supertest(server)
			.post('/claim/xem')
			.send({ address: 'abc', amount: 100 })
			.set('Accept', 'application/json');

		// Assert:
		expect(response.status).to.be.equal(500);
	});
});
