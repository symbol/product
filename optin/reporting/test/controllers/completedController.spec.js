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
	const parameter = {
		pageSize: 10,
		pageNumber: 1,
		optinType: '',
		nemAddress: '',
		symbolAddress: '',
		transactionHash: ''
	};
	const mockCompletedData = TestUtils.buildCompletedDBData();

	beforeEach(() => {
		getCompletedPaginationStub = stub(CompletedDB, 'getCompletedPagination');
		getTotalRecordStub = stub(CompletedDB, 'getTotalRecord');
		req = TestUtils.mockRequest(parameter);
		res = TestUtils.mockResponse();
	});

	afterEach(() => {
		req = {};
		res = {};
		restore();
	});

	describe('getCompleted', () => {
		const runBasicCompletedDataTests = async ({ mockNemSources, mockSymbolSources }) => {
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

			expect(result.optinId).to.be.equal(1);
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

		const runBasicQueryTests = async overWriteParams => {
			// Arrange:
			req = TestUtils.mockRequest({
				...parameter,
				...overWriteParams
			});

			getCompletedPaginationStub.returns(Promise.resolve([]));

			// Act:
			await CompletedController.getCompleted(req, res);

			// Assert:
			const result = res.json.getCall(0).firstArg;
			expect(result).not.to.haveOwnProperty('error');
		};

		it('returns basic data', async () => {
			await runBasicCompletedDataTests({
				mockNemSources: mockCompletedData[0].nemSource,
				mockSymbolSources: mockCompletedData[0].symbolDestination
			});
		});

		it('returns data with optin type merge', async () => {
			await runBasicCompletedDataTests({
				mockNemSources: mockCompletedData[1].nemSource,
				mockSymbolSources: mockCompletedData[1].symbolDestination
			});
		});

		it('returns data with optin type multi', async () => {
			await runBasicCompletedDataTests({
				mockNemSources: mockCompletedData[2].nemSource,
				mockSymbolSources: mockCompletedData[2].symbolDestination
			});
		});

		it('returns filtered nem address', async () => {
			await runBasicQueryTests({
				nemAddress: 'NAX27ORAIVEGT4BHQ5EP3F4QZ76OGXUHEJSHWQBZ'
			});
		});

		it('returns filtered symbol address', async () => {
			await runBasicQueryTests({
				symbolAddress: 'NCFNYXJR6SPZDCWHDXHBRZYILFCK5KYK6YHYVVY'
			});
		});

		it('returns filtered transaction hash', async () => {
			await runBasicQueryTests({
				transactionHash: 'cdb0af349823f1638e032dcab15fd33049c383feee642cbc67e11020dc30f190'
			});
		});

		it('returns filtered pre optin', async () => {
			await runBasicQueryTests({
				optinType: 'pre'
			});
		});

		it('returns filtered post optin', async () => {
			await runBasicQueryTests({
				optinType: 'post'
			});
		});

		it('throw error', async () => {
			// Arrange:
			getCompletedPaginationStub.throws(new Error('database error'));

			// Act:
			await CompletedController.getCompleted(req, res);

			// Assert:
			const { data, error } = res.json.getCall(0).firstArg;

			expect(data).to.be.eql([]);
			expect(error).to.be.equal('database error');
		});
	});

	describe('exportCsv', async () => {
		beforeEach(async () => {
			// Arrange:
			getCompletedPaginationStub.returns(Promise.resolve(mockCompletedData));

			// Act:
			await CompletedController.exportCsv(req, res);
		});

		it('returns csv data', async () => {
			// Assert:
			const result = res.send.getCall(0).firstArg;
			const csv = result.split('\n');

			expect(csv.length).to.be.equal(8);

			expect(csv[0]).to.be.equal('"#","Type","Label","NEM Address","Hash","Height","Timestamp","Timestamp [UTC]","Balance",'
				+ '"Symbol Address","Hash","Height","Timestamp","Timestamp [UTC]","Balance"');

			expect(csv[1]).to.be.equal('1,"POST","Bithumb","NAX27ORAIVEGT4BHQ5EP3F4QZ76OGXUHEJSHWQBZ",'
				+ '"CDB0AF349823F1638E032DCAB15FD33049C383FEEE642CBC67E11020DC30F190","3004351",'
				+ '"20-12-31 08:33:16","20-12-31 08:33:16",79268194.338335,'
				+ '"NCFNYXJR6SPZDCWHDXHBRZYILFCK5KYK6YHYVVY","E49B240D76DAE7277089C2BDA66B297A05AE700361ED253ED48435E9AF9B0FE1",'
				+ '"1","21-03-16 00:06:25","21-03-16 00:06:25",79268194.338335');

			expect(csv[2]).to.be.equal('1,"POST","","NAZKYWOF62YYK2ZAUMO6DQ3FQM6KLFAFH5ESXWKA",'
				+ '"EB4E08242F8A2CC0A163465F2DD7D9DA48ACB5DB10BAEA324FA8A5233372428E;'
				+ '6E67F6688B34AE387E08D72C9C4D3A96806AAB0C9468B0B39F25823848903567;'
				+ 'C27F9084A4441622F307085A191C30AF8708293E8A57342B26CAE20239D54265",'
				+ '"3207402","21-05-22 12:41:11","21-05-22 12:41:11",749450.9,'
				+ '"NDXH7LXKB2WPKEGVFFGYXWZ462SIVYEXCFSDSLQ",'
				+ '"78702FF2EED9121B618B6595AF0FCE455A9D18BD61455FD733BC57C069DD825A","202884",'
				+ '"21-05-26 11:23:53","21-05-26 11:23:53",749450.9');

			expect(csv[3]).to.be.equal('1,"PRE","NEM Group Trust","NANODESTSN7GU76QPLGMJ7BCGCAA2PHVBZZUUI62",'
				+ '"(off-chain)",,,,18983656.691,"NDX4GP6OL32EOSGXSB5FTGKXDJZP4D535ZZYDFI",'
				+ '"F24F32738B32B7D6F798CDDB065AB2974D387C83A8A4B03385C8F2C8DC8B1BF7",'
				+ '"1","21-03-16 00:06:25","21-03-16 00:06:25",51000000');

			expect(csv[4]).to.be.equal('1,"PRE","","NBKXLNQ2GKTLQBTXNFOHULNJDA7T2Q57CZGQ2TFP",'
				+ '"(off-chain)",,,,234150985.7,"ND6667LJBJJ6UMJSZKN2BLHQCS3WNZ3W4UGCFKI",'
				+ '"598EF664F3B7F48ECD13486E29269F4D55949505A901D25C8EA619344BC17671","1",'
				+ '"21-03-16 00:06:25","21-03-16 00:06:25",51000000');

			expect(csv[5]).to.be.equal('1,"PRE","","","(off-chain)",,,,"","NALOQMBU45WOLZ4BCBYZX3N2Y2VSYQFOXGAO34A",'
				+ '"B825082702295438CC331A0BCC8AD698D22CCE848661BE55C4389140C36C67EE",'
				+ '"1","21-03-16 00:06:25","21-03-16 00:06:25",51000000');

			expect(csv[6]).to.be.equal('1,"PRE","NEM Group Trust","NANODESTSN7GU76QPLGMJ7BCGCAA2PHVBZZUUI62",'
				+ '"(off-chain)",,,,18983656.691,"NDX4GP6OL32EOSGXSB5FTGKXDJZP4D535ZZYDFI",'
				+ '"F24F32738B32B7D6F798CDDB065AB2974D387C83A8A4B03385C8F2C8DC8B1BF7",'
				+ '"1","21-03-16 00:06:25","21-03-16 00:06:25",51000000');

			expect(csv[7]).to.be.equal('1,"PRE","","NBKXLNQ2GKTLQBTXNFOHULNJDA7T2Q57CZGQ2TFP",'
				+ '"(off-chain)",,,,234150985.7,"","",,,,""');
		});

		it('returns test/csv in response header content type', async () => {
			// Arrange + Act:
			const result = res.header.getCall(0).lastArg;

			// Assert:
			expect(result).to.be.equal('text/csv');
		});

		it('returns name in response attachment', async () => {
			// Arrange + Act:
			const result = res.attachment.getCall(0).firstArg;

			// Assert:
			expect(result).to.be.eql('completed.csv');
		});
	});
});
