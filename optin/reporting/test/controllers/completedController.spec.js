const CompletedController = require('../../controllers/completedController');
const CompletedDB = require('../../models/completed');
const { hexStringToByte, formatStringSplit } = require('../../utils/ServerUtils');
const TestUtils = require('../TestUtils');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const { NemFacade, SymbolFacade } = require('symbol-sdk').facade;

const mockCompletedData = {
	basic: TestUtils.mockCompletedDBRecord(
		1,
		[{
			address: '682FAFBA20454869F0278748FD9790CFFCE35E8722647B4039',
			balance: 79268194338335,
			hashes: 'CDB0AF349823F1638E032DCAB15FD33049C383FEEE642CBC67E11020DC30F190',
			height: 3004351,
			label: 'Bithumb',
			timestamps: '1609403596'
		}],
		[{
			address: '688ADC5D31F49F918AC71DCE18E7085944AEAB0AF60F8AD7',
			balance: 79268194338335,
			hashes: 'E49B240D76DAE7277089C2BDA66B297A05AE700361ED253ED48435E9AF9B0FE1',
			height: 1,
			timestamps: 1615853185
		}], 1
	)[0],
	multi1: TestUtils.mockCompletedDBRecord(
		1,
		[{
			address: '681AE19253937E6A7FD07ACCC4FC2230800D3CF50E734A23DA',
			balance: 18983656691000,
			hashes: null,
			height: null,
			label: 'NEM Group Trust',
			timestamps: null
		},
		{
			address: '685575B61A32A6B80677695C7A2DA9183F3D43BF164D0D4CAF',
			balance: 234150985700000,
			hashes: null,
			height: null,
			label: 'NEM Group Trust',
			timestamps: null
		}],
		[{
			address: '68EFC33FCE5EF44748D7907A5999571A72FE0FBBEE738195',
			balance: 51000000000000,
			hashes: 'F24F32738B32B7D6F798CDDB065AB2974D387C83A8A4B03385C8F2C8DC8B1BF7',
			height: 1,
			timestamps: 1615853185
		},
		{
			address: '68FDEF7D690A53EA3132CA9BA0ACF014B766E776E50C22A9',
			balance: 51000000000000,
			hashes: '598EF664F3B7F48ECD13486E29269F4D55949505A901D25C8EA619344BC17671',
			height: 1,
			timestamps: 1615853185
		},
		{
			address: '6816E83034E76CE5E78110719BEDBAC6AB2C40AEB980EDF0',
			balance: 51000000000000,
			hashes: 'B825082702295438CC331A0BCC8AD698D22CCE848661BE55C4389140C36C67EE',
			height: 1,
			timestamps: 1615853185
		}], 0
	)[0],
	multi2: TestUtils.mockCompletedDBRecord(
		1,
		[{
			address: '681AE19253937E6A7FD07ACCC4FC2230800D3CF50E734A23DA',
			balance: 18983656691000,
			hashes: null,
			height: null,
			label: 'NEM Group Trust',
			timestamps: null
		},
		{
			address: '685575B61A32A6B80677695C7A2DA9183F3D43BF164D0D4CAF',
			balance: 234150985700000,
			hashes: null,
			height: null,
			label: 'NEM Group Trust',
			timestamps: null
		}],
		[{
			address: '68EFC33FCE5EF44748D7907A5999571A72FE0FBBEE738195',
			balance: 51000000000000,
			hashes: 'F24F32738B32B7D6F798CDDB065AB2974D387C83A8A4B03385C8F2C8DC8B1BF7',
			height: 1,
			timestamps: 1615853185
		}], 0
	)[0],
	merge: TestUtils.mockCompletedDBRecord(
		1,
		[{
			address: '6832AC59C5F6B1856B20A31DE1C365833CA594053F492BD940',
			balance: 749450900000,
            hashes: 'EB4E08242F8A2CC0A163465F2DD7D9DA48ACB5DB10BAEA324FA8A5233372428E;6E67F6688B34AE387E08D72C9C4D3A96806AAB0C9468B0B39F25823848903567;C27F9084A4441622F307085A191C30AF8708293E8A57342B26CAE20239D54265', //eslint-disable-line
			height: '3207402;3207400;3207398',
			label: null,
			timestamps: '1621687271;1621687173;1621687107'
		}],
		[{
			address: '68EE7FAEEA0EACF510D5294D8BDB3CF6A48AE0971164392E',
			balance: 749450900000,
			hashes: '78702FF2EED9121B618B6595AF0FCE455A9D18BD61455FD733BC57C069DD825A',
			height: 202884,
			timestamps: 1622028233.132
		}]
	)[0]
};

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

			expect(pagination).to.be.deep.equal({ pageSize: recordSize, pageNumber: 1, totalRecord: recordSize });
			expect(data.length).to.be.equal(10);

			expect(result.optinId).to.be.equal(1);
			expect(result.isPostoptin).to.be.equal(1);
			expect(result.label).to.be.deep.equal(mockNemSources.map(nemInfo => nemInfo.label));
			expect(result.nemAddress).to.be.deep.equal(mockNemSources.map(nemInfo =>
				new NemFacade.Address(hexStringToByte(nemInfo.address)).toString()));
			expect(result.nemHeights).to.be.deep.equal(mockNemSources.map(nemInfo => formatStringSplit(nemInfo.height)));
			expect(result.nemHashes).to.be.deep.equal(mockNemSources.map(nemInfo => formatStringSplit(nemInfo.hashes)));
			expect(result.nemTimestamps).to.be.deep.equal(mockNemSources.map(nemInfo => formatStringSplit(nemInfo.timestamps)));
			expect(result.nemBalance).to.be.deep.equal(mockNemSources.map(nemInfo => nemInfo.balance));
			expect(result.symbolAddress).to.be.deep.equal(mockSymbolSources.map(symbolInfo =>
				new SymbolFacade.Address(hexStringToByte(symbolInfo.address)).toString()));
			expect(result.symbolHeights).to.be.deep.equal(mockSymbolSources.map(symbolInfo => symbolInfo.height));
			expect(result.symbolHashes).to.be.deep.equal(mockSymbolSources.map(symbolInfo => symbolInfo.hashes));
			expect(result.symbolTimestamps).to.be.deep.equal(mockSymbolSources.map(symbolInfo => symbolInfo.timestamps));
			expect(result.symbolBalance).to.be.deep.equal(mockSymbolSources.map(symbolInfo => symbolInfo.balance));
		};

		const runBasicQueryTests = async overwriteParams => {
			// Arrange:
			req = TestUtils.mockRequest({
				...parameter,
				...overwriteParams
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
				mockNemSources: mockCompletedData.basic.nemSource,
				mockSymbolSources: mockCompletedData.basic.symbolDestination
			});
		});

		it('returns data with optin type merge', async () => {
			await runBasicCompletedDataTests({
				mockNemSources: mockCompletedData.merge.nemSource,
				mockSymbolSources: mockCompletedData.merge.symbolDestination
			});
		});

		it('returns data with optin type multi', async () => {
			await runBasicCompletedDataTests({
				mockNemSources: mockCompletedData.multi2.nemSource,
				mockSymbolSources: mockCompletedData.multi2.symbolDestination
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

		it('renders error when database query fails', async () => {
			// Arrange:
			getCompletedPaginationStub.throws(new Error('database error'));

			// Act:
			await CompletedController.getCompleted(req, res);

			// Assert:
			const { data, error } = res.json.getCall(0).firstArg;

			expect(data).to.be.deep.equal([]);
			expect(error).to.be.equal('database error');
		});
	});

	describe('exportCsv', async () => {
		beforeEach(async () => {
			// Arrange:
			getCompletedPaginationStub.returns(Promise.resolve([
				mockCompletedData.basic,
				mockCompletedData.merge,
				mockCompletedData.multi1,
				mockCompletedData.multi2
			]));

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
			expect(result).to.be.deep.equal('completed.csv');
		});
	});
});
