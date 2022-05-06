const { stub } = require('sinon');

const TestUtils = {
	mockRequest: query => ({
		query
	}),
	mockResponse: () => {
		const res = {};
		res.json = stub().returns(res);
		res.header = stub().returns(res);
		res.attachment = stub().returns(res);
		res.send = stub().returns(res);
		return res;
	},
	mockCompletedDBRecord: (numberOfRecords, nemSource, symbolSource) => [...Array(numberOfRecords).keys()].map(index => ({
		id: index + 1,
		is_postoptin: 1,
		nemSource,
		symbolDestination: symbolSource
	})),
	mockInProgressDBRecord: numberOfRecords => [...Array(numberOfRecords).keys()].map(index => ({
		optinTransactionHeight: 1 + index,
		nemAddressBytes: Buffer.from('681c5f1908dec6b72bc20c7d23afc8a78caa8f2709eb5c44a6', 'hex'),
		optinTransactionHashHex: 'F5D493494DCACF5FAE2F1AEA02165C8892699BB9879075F9D0AD63AC4B00491F',
		payoutTransactionHeight: 1 + index,
		payoutTransactionHash: '4AC160A12835AA3F313676173386ED4F1AC6F840BDF1EA039725FC1B31B47B8B',
		payoutStatus: 1,
		message: null,
		optinTimestamp: 1650037614,
		payoutTimestamp: 1650399515.862
	}))
};

module.exports = TestUtils;
