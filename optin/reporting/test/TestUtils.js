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
	mockCompletedDBRecord: (numberOfRecords, nemSource, symbolSource, isPostoptin = 1) => [...Array(numberOfRecords).keys()].map(index => ({
		id: index + 1,
		isPostoptin,
		nemSource,
		symbolDestination: symbolSource
	})),
	mockInProgressDBRecord: (numberOfRecords, payoutStatus = 0) => [...Array(numberOfRecords).keys()].map(index => ({
		optinTransactionHeight: 1 + index,
		nemAddressBytes: Buffer.from('681c5f1908dec6b72bc20c7d23afc8a78caa8f2709eb5c44a6', 'hex'),
		optinTransactionHashHex: 'F5D493494DCACF5FAE2F1AEA02165C8892699BB9879075F9D0AD63AC4B00491F',
		payoutTransactionHeight: 1 + index,
		payoutTransactionHash: '4AC160A12835AA3F313676173386ED4F1AC6F840BDF1EA039725FC1B31B47B8B',
		payoutStatus,
		message: null,
		optinTimestamp: 1650037614,
		payoutTimestamp: 1650399515.862
	})),
	buildCompletedDBData: () => {
		const mockBasicRow = TestUtils.mockCompletedDBRecord(
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
		);

		const mockRowMulti1 = TestUtils.mockCompletedDBRecord(
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
		);

		const mockRowMulti2 = TestUtils.mockCompletedDBRecord(
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
		);

		const mockRowMerge = TestUtils.mockCompletedDBRecord(
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
		);

		return [
			...mockBasicRow,
			...mockRowMerge,
			...mockRowMulti1,
			...mockRowMulti2
		];
	}
};

module.exports = TestUtils;
