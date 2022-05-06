const CompletedController = require('../../controllers/completedController');
const CompletedDB = require('../../models/completed');
const { hexStringToByte, formatStringSplit } = require('../../utils/ServerUtils');
const TestUtils = require('../TestUtils');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const { NemFacade, SymbolFacade } = require('symbol-sdk').facade;

describe('completed controller', () => {
	let getCompletedPaginationStub = {};
	let getTotalRecordStub = {};
	let req = {};
	let res = {};

	beforeEach(() => {
		getCompletedPaginationStub = stub(CompletedDB, 'getCompletedPagination');
		getTotalRecordStub = stub(CompletedDB, 'getTotalRecord');
		req = TestUtils.mockRequest({
			pageSize: 10, pageNumber: 1, optinType: 0, nemAddress: '', symbolAddress: '', transactionHash: ''
		});
		res = TestUtils.mockResponse();
	});

	afterEach(() => {
		req = {};
		res = {};
		restore();
	});

	describe('getCompleted', () => {
		const runBasicCompletedDataTests = async (mockNemSources, mockSymbolSources) => {
			// Arrange:
			const recordSize = 10;
			const mockDb = TestUtils.mockCompletedDBRecord(recordSize, mockNemSources, mockSymbolSources);

			getCompletedPaginationStub.returns(Promise.resolve(mockDb));
			getTotalRecordStub.returns(Promise.resolve(recordSize));

			// Act:
			await CompletedController.getCompleted(req, res);

			// Assert:
			const { pagination, data } = res.json.getCall(0).firstArg;
			const result = data[0];

			expect(pagination).to.be.eql({ pageSize: recordSize, pageNumber: 1, totalRecord: recordSize });
			expect(data.length).to.be.equal(10);

			expect(result.optin_id).to.be.equal(1);
			expect(result.isPostoptin).to.be.equal(1);
			expect(result.label).to.be.eql(mockNemSources.map(nemInfo => nemInfo.label));
			expect(result.nemAddress).to.be.eql(mockNemSources.map(nemInfo =>
				new NemFacade.Address(hexStringToByte(nemInfo.address)).toString()));
			expect(result.nemHeights).to.be.eql(mockNemSources.map(nemInfo => formatStringSplit(nemInfo.height)));
			expect(result.nemHashes).to.be.eql(mockNemSources.map(nemInfo => formatStringSplit(nemInfo.hashes)));
			expect(result.nemTimestamps).to.be.eql(mockNemSources.map(nemInfo => formatStringSplit(nemInfo.timestamps)));
			expect(result.nemBalance).to.be.eql(mockNemSources.map(nemInfo => nemInfo.balance));
			expect(result.symbolAddress).to.be.eql(mockSymbolSources.map(symbolInfo =>
				new SymbolFacade.Address(hexStringToByte(symbolInfo.address)).toString()));
			expect(result.symbolHeights).to.be.eql(mockSymbolSources.map(symbolInfo => symbolInfo.height));
			expect(result.symbolHashes).to.be.eql(mockSymbolSources.map(symbolInfo => symbolInfo.hashes));
			expect(result.symbolTimestamps).to.be.eql(mockSymbolSources.map(symbolInfo => symbolInfo.timestamps));
			expect(result.symbolBalance).to.be.eql(mockSymbolSources.map(symbolInfo => symbolInfo.balance));
		};

		it('should return basic data', async () => {
			const mockNemSources = [{
				address: '682FAFBA20454869F0278748FD9790CFFCE35E8722647B4039',
				balance: 79268194338335,
				hashes: 'CDB0AF349823F1638E032DCAB15FD33049C383FEEE642CBC67E11020DC30F190',
				height: 3004351,
				label: 'Bithumb',
				timestamps: '1609403596'
			}];

			const mockSymbolSources = [{
				address: '688ADC5D31F49F918AC71DCE18E7085944AEAB0AF60F8AD7',
				balance: 79268194338335,
				hashes: 'E49B240D76DAE7277089C2BDA66B297A05AE700361ED253ED48435E9AF9B0FE1',
				height: 1,
				timestamps: 1615853185
			}];

			await runBasicCompletedDataTests(mockNemSources, mockSymbolSources);
		});

		it('should return data with optin type merge', async () => {
			const mockNemSources = [{
				address: '6832AC59C5F6B1856B20A31DE1C365833CA594053F492BD940',
				balance: 749450900000,
				hashes: 'EB4E08242F8A2CC0A163465F2DD7D9DA48ACB5DB10BAEA324FA8A5233372428E;6E67F6688B34AE387E08D72C9C4D3A96806AAB0C9468B0B39F25823848903567;C27F9084A4441622F307085A191C30AF8708293E8A57342B26CAE20239D54265', //eslint-disable-line
				height: '3207402;3207400;3207398',
				label: null,
				timestamps: '1621687271;1621687173;1621687107'
			}];

			const mockSymbolSources = [{
				address: '68EE7FAEEA0EACF510D5294D8BDB3CF6A48AE0971164392E',
				balance: 749450900000,
				hashes: '78702FF2EED9121B618B6595AF0FCE455A9D18BD61455FD733BC57C069DD825A',
				height: 202884,
				timestamps: 1622028233.132
			}];

			await runBasicCompletedDataTests(mockNemSources, mockSymbolSources);
		});

		it('should return data with optin type multi', async () => {
			const mockNemSources = [{
				address: '68BDCA15D68BBC0AB2C5AE825BE9B3F5B46A455A23AFE29599',
				balance: 258831052617,
				hashes: '3DF6DF7B8E45BC2F2035B3E38B16048348F46448DA8C26FB0B5AE78093AC18BE',
				height: '3024465',
				label: 'Binance',
				timestamps: '1610619747'
			}, {
				address: '68C31A149F8F5C069064E6EA29B29589E68F5F3F9C0B56CD94',
				balance: 784381705525248,
				hashes: '98EC4C714DA6ED0E31ACA3AC5F0C1141F49C4BFD469FDD372A7F9B4EFD03A476',
				height: '3015648',
				label: 'Binance',
				timestamps: '1610087128'
			}];

			const mockSymbolSources = [{
				address: '6812DBE4C421C7DF1B4AADC8A71053620CA6232DF62E391D',
				balance: 784640536577865,
				hashes: '"39C4AD7D75B6DF3800340DF89803C079C8E549C5F4D9E62160D06F391D43662E"',
				height: 1,
				timestamps: 1615853185
			}];

			await runBasicCompletedDataTests(mockNemSources, mockSymbolSources);
		});
	});

	describe('exportCsv', async () => {
		beforeEach(async () => {
			// Arrange:
			const mockNemSources = [{
				address: '682FAFBA20454869F0278748FD9790CFFCE35E8722647B4039',
				balance: 79268194338335,
				hashes: 'CDB0AF349823F1638E032DCAB15FD33049C383FEEE642CBC67E11020DC30F190',
				height: 3004351,
				label: 'Bithumb',
				timestamps: '1609403596'
			}];

			const mockSymbolSources = [{
				address: '688ADC5D31F49F918AC71DCE18E7085944AEAB0AF60F8AD7',
				balance: 79268194338335,
				hashes: 'E49B240D76DAE7277089C2BDA66B297A05AE700361ED253ED48435E9AF9B0FE1',
				height: 1,
				timestamps: 1615853185
			}];

			const mockDb = TestUtils.mockCompletedDBRecord(1, mockNemSources, mockSymbolSources);

			getCompletedPaginationStub.returns(Promise.resolve(mockDb));

			// Act:
			await CompletedController.exportCsv(req, res);
		});

		it('should return csv data', async () => {
			// Assert:
			const result = res.send.getCall(0).firstArg;
			const csv = result.split('\n');

			expect(csv[0]).to.be.equal('"#","Type","Label","NEM Address","Hash","Height","Timestamp","Timestamp [UTC]","Balance",'
				+ '"Symbol Address","Hash","Height","Timestamp","Timestamp [UTC]","Balance"');
			expect(csv[1]).to.be.equal('1,"POST","Bithumb","NAX27ORAIVEGT4BHQ5EP3F4QZ76OGXUHEJSHWQBZ",'
				+ '"CDB0AF349823F1638E032DCAB15FD33049C383FEEE642CBC67E11020DC30F190","3004351","20-12-31 08:33:16",'
				+ '"20-12-31 08:33:16",79268194.338335,"NCFNYXJR6SPZDCWHDXHBRZYILFCK5KYK6YHYVVY",'
				+ '"E49B240D76DAE7277089C2BDA66B297A05AE700361ED253ED48435E9AF9B0FE1","1",'
				+ '"21-03-16 00:06:25","21-03-16 00:06:25",79268194.338335');
		});

		it('should return test/csv in response header content type', async () => {
			// Assert:
			const result = res.header.getCall(0).lastArg;
			expect(result).to.be.equal('text/csv');
		});

		it('should return name in response attachment', async () => {
			// Assert:
			const result = res.attachment.getCall(0).firstArg;
			expect(result).to.be.eql('completed.csv');
		});
	});
});
