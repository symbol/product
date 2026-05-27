/* eslint-disable max-len */

jest.mock('@/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/utils/server'),
	makeRequest: jest.fn()
}));

describe('variants/symbol/api', () => {
	const originalAppConfig = window.appConfig;

	beforeEach(() => {
		jest.resetModules();
		window.appConfig = {
			PLATFORM: 'symbol',
			NATIVE_MOSAIC_ID: 'E74B99BA41F4AFEE',
			NATIVE_MOSAIC_TICKER: 'XYM',
			NATIVE_MOSAIC_DIVISIBILITY: 6,
			REQUEST_TIMEOUT: 5000,
			SYMBOL_NODE_URL: 'https://symbol.node',
			SYMBOL_NETWORK_IDENTIFIER: 152,
			SYMBOL_EPOCH_ADJUSTMENT: 1667250467
		};
	});

	afterEach(() => {
		window.appConfig = originalAppConfig;
	});

	it('maps the Symbol transactions/confirmed response into Explorer transaction rows', async () => {
		// Arrange:
		const { makeRequest } = require('@/utils/server');
		const { fetchTransactionPage } = require('@/variants/symbol/api/transactions');
		const response = {
			data: [
				{
					meta: {
						height: '3410448',
						hash: '594598B5261E107632A7C3E8FD5FED2C8EC438B6D6DC6F87284F7C1FABA093A0',
						merkleComponentHash: '2B95076E0F999CAA94BC252186BB3718330EFB93966E553F32FABF6DE9E8CCEA',
						index: 0,
						timestamp: '112593657129',
						feeMultiplier: 100
					},
					transaction: {
						size: 608,
						signature:
							'9B78F979B15861EE8C234C2BB76E200359EA9FC3E027A9F05ACCF808FF4A70006C0EC9190991FC26A797578ED5DECB96620C421A0292055FB7A726D4742CA505',
						signerPublicKey: '2121257F481EBAB9000D10BDEDB5670EEF83D4AEA552BDC208B55F619752F777',
						version: 3,
						network: 152,
						type: 16961,
						maxFee: '60800',
						deadline: '112600815025',
						transactionsHash: '3D0A1FCB2DF0D61CB0F24CF210896EB714AACEDA54699A66C80EC0A9994DA350',
						cosignatures: [
							{
								version: '0',
								signerPublicKey: 'C64A572AA15FC4D56BBAB855A9DAE821117A19FC69D7F706D8B33BB628DC1D62',
								signature:
									'A4EC71D228E83C012727A980C0038520AF5887662D1858FB4F6CFEBF143989397E529C348C691BDA9A5A69F0299BD74E1D1FB93BD45F1A32274C4915BEFA6E0E'
							},
							{
								version: '0',
								signerPublicKey: 'C6542BEF56B74C54475EAE064968E1873B9DAD88194A05EF794B4C90984C039B',
								signature:
									'2F2A7549554E5393FFCFEF578C2F527D7A4CDEFEAA419F31CF78E9B21299F758F919057E53A70837E78DFE25484B44E24DFB9729C8ABF90802A80D8B88DB0903'
							},
							{
								version: '0',
								signerPublicKey: 'CDE8C6A35343E4C84CED222CA9249003DEF84D5AE9011D4705D12EE2FFE4FC13',
								signature:
									'E32A770BAC4C5D5C7300933B24962F24DA5B883FD919CFBB3CC3E6621F1E621BDC93F4D8C5212FE6E03EA024DBE66FB1E1380EF56A8F9D00F10CA63FB9C23900'
							}
						]
					},
					id: '6A16441AFD8A987E1A10B60A'
				},
				{
					meta: {
						height: '3410447',
						hash: '1052B9D4568CE10FD5747B62FDB3F2EE9856C709C616B2E0BBE42EBEE90148B5',
						merkleComponentHash: '1052B9D4568CE10FD5747B62FDB3F2EE9856C709C616B2E0BBE42EBEE90148B5',
						index: 0,
						timestamp: '112593626037',
						feeMultiplier: 100
					},
					transaction: {
						size: 184,
						signature:
							'E2C3AE590F306A2735ED8742D3C50A82A8F06216BB22452EBC4791B4ECEDFE3DF5614284CCEA417C2D2EAB24B1185007BBC29A4F6FD21715A4F896C434F35402',
						signerPublicKey: '2121257F481EBAB9000D10BDEDB5670EEF83D4AEA552BDC208B55F619752F777',
						version: 1,
						network: 152,
						type: 16712,
						maxFee: '18400',
						deadline: '112600815085',
						duration: '100',
						mosaicId: 'E74B99BA41F4AFEE',
						amount: '10000000',
						hash: '594598B5261E107632A7C3E8FD5FED2C8EC438B6D6DC6F87284F7C1FABA093A0'
					},
					id: '6A1643FBFD8A987E1A10B601'
				},
				{
					meta: {
						height: '3410446',
						hash: 'EBE84855ACF7BE1F592037DB42C6A7D6912C60043DD9C0E9A1433606DCEBD9F0',
						merkleComponentHash: 'EBE84855ACF7BE1F592037DB42C6A7D6912C60043DD9C0E9A1433606DCEBD9F0',
						index: 0,
						timestamp: '112593604952',
						feeMultiplier: 100
					},
					transaction: {
						size: 176,
						signature:
							'F64ADD3F8FD89B35304FD8CB82B4B490A79759666DB43EC3DD5887F481260F1B443663AD22677E7D2ECEEEFF798281E485CB8DE57B87F05FDAF389177EEB290E',
						signerPublicKey: '81EA7C15E7EC06261C9F654F54EAC4748CFCF00E09A8FE47779ACD14A7602004',
						version: 1,
						network: 152,
						type: 16724,
						maxFee: '17600',
						deadline: '112600774897',
						recipientAddress: '981308B3321751BD49DF567C2A928893BB3F9097AA354A84',
						mosaics: [
							{
								id: 'E74B99BA41F4AFEE',
								amount: '500000000'
							}
						]
					},
					id: '6A1643E6FD8A987E1A10B5FC'
				}
			],
			pagination: {
				pageNumber: 1,
				pageSize: 3
			}
		};
		makeRequest.mockResolvedValue(response);

		// Act:
		const result = await fetchTransactionPage();

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/transactions/confirmed?pageNumber=1&pageSize=10&order=desc&orderBy=id');
		expect(result.data).toHaveLength(response.data.length);
		expect(result.data[0].type).toBe('AGGREGATE_BONDED');
		expect(result.data[1].type).toBe('HASH_LOCK');
		expect(result.data[2]).toEqual({
			hash: response.data[2].meta.hash,
			height: Number(response.data[2].meta.height),
			type: 'TRANSFER',
			signer: 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY',
			sender: 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY',
			recipient: 'TAJQRMZSC5I32SO7KZ6CVEUISO5T7EEXVI2UVBA',
			value: [
				{
					id: response.data[2].transaction.mosaics[0].id,
					name: 'XYM',
					amount: 500
				}
			],
			amount: 500,
			fee: 0.0176,
			timestamp: '2026-05-27T01:07:51.952Z',
			message: ''
		});
		expect(result.pageNumber).toBe(response.pagination.pageNumber);
	});

	it('maps all supported Symbol transaction types', async () => {
		// Arrange:
		const { TRANSACTION_TYPE } = require('@/constants');
		const { makeRequest } = require('@/utils/server');
		const { fetchTransactionPage } = require('@/variants/symbol/api/transactions');
		const transactionTypes = [
			[16716, TRANSACTION_TYPE.ACCOUNT_KEY_LINK],
			[16963, TRANSACTION_TYPE.VRF_KEY_LINK],
			[16707, TRANSACTION_TYPE.VOTING_KEY_LINK],
			[16972, TRANSACTION_TYPE.NODE_KEY_LINK],
			[16705, TRANSACTION_TYPE.AGGREGATE_COMPLETE],
			[16961, TRANSACTION_TYPE.AGGREGATE_BONDED],
			[16717, TRANSACTION_TYPE.MOSAIC_DEFINITION],
			[16973, TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE],
			[17229, TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION],
			[16718, TRANSACTION_TYPE.NAMESPACE_REGISTRATION],
			[16974, TRANSACTION_TYPE.ADDRESS_ALIAS],
			[17230, TRANSACTION_TYPE.MOSAIC_ALIAS],
			[16708, TRANSACTION_TYPE.ACCOUNT_METADATA],
			[16964, TRANSACTION_TYPE.MOSAIC_METADATA],
			[17220, TRANSACTION_TYPE.NAMESPACE_METADATA],
			[16725, TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION],
			[16712, TRANSACTION_TYPE.HASH_LOCK],
			[16722, TRANSACTION_TYPE.SECRET_LOCK],
			[16978, TRANSACTION_TYPE.SECRET_PROOF],
			[16720, TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION],
			[16976, TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION],
			[17232, TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION],
			[16721, TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION],
			[16977, TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION],
			[16724, TRANSACTION_TYPE.TRANSFER]
		];
		const response = {
			data: transactionTypes.map(([type], index) => ({
				meta: {
					height: `${1000 + index}`,
					hash: `HASH${index}`,
					timestamp: '112593604952'
				},
				transaction: {
					type,
					signerPublicKey: '81EA7C15E7EC06261C9F654F54EAC4748CFCF00E09A8FE47779ACD14A7602004',
					maxFee: '17600',
					mosaics: type === 16724 ? [{ id: 'E74B99BA41F4AFEE', amount: '500000000' }] : []
				},
				id: `ID${index}`
			})),
			pagination: {
				pageNumber: 1,
				pageSize: transactionTypes.length
			}
		};
		makeRequest.mockResolvedValue(response);

		// Act:
		const result = await fetchTransactionPage();

		// Assert:
		expect(result.data.map(transaction => transaction.type)).toEqual(transactionTypes.map(([, expectedType]) => expectedType));
	});

	it('uses a relative proxy path when the configured Symbol node URL has a trailing slash', async () => {
		// Arrange:
		window.appConfig = {
			...window.appConfig,
			SYMBOL_NODE_URL: 'https://symbol.node/'
		};
		jest.resetModules();
		const { makeRequest } = require('@/utils/server');
		const { fetchTransactionPage } = require('@/variants/symbol/api/transactions');
		makeRequest.mockResolvedValue({
			data: [],
			pagination: {
				pageNumber: 1,
				pageSize: 10
			}
		});

		// Act:
		await fetchTransactionPage();

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/transactions/confirmed?pageNumber=1&pageSize=10&order=desc&orderBy=id');
	});

	it('returns an empty transaction page for unsupported temporary Symbol node proxy filters', async () => {
		// Arrange:
		const { makeRequest } = require('@/utils/server');
		const { fetchTransactionPage } = require('@/variants/symbol/api/transactions');

		// Act:
		const result = await fetchTransactionPage({
			address: 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY',
			height: 3410446,
			mosaic: 'E74B99BA41F4AFEE',
			from: 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY',
			to: 'TAJQRMZSC5I32SO7KZ6CVEUISO5T7EEXVI2UVBA',
			types: 'TRANSFER'
		});

		// Assert:
		expect(makeRequest).not.toHaveBeenCalled();
		expect(result).toEqual({
			data: [],
			pageNumber: 1
		});
	});

	it('returns an empty account page for unsupported temporary Symbol node proxy filters', async () => {
		// Arrange:
		const { makeRequest } = require('@/utils/server');
		const { fetchAccountPage } = require('@/variants/symbol/api/accounts');

		// Act:
		const result = await fetchAccountPage({
			mosaic: 'E74B99BA41F4AFEE',
			isLatest: true,
			isActiveHarvesting: true,
			pageSize: 50
		});

		// Assert:
		expect(makeRequest).not.toHaveBeenCalled();
		expect(result).toEqual({
			data: [],
			pageNumber: 1
		});
	});

	it('maps Symbol accounts/search responses into Explorer account rows', async () => {
		// Arrange:
		const { makeRequest } = require('@/utils/server');
		const { fetchAccountPage } = require('@/variants/symbol/api/accounts');
		const response = {
			data: [
				{
					account: {
						address: '981308B3321751BD49DF567C2A928893BB3F9097AA354A84',
						addressHeight: '3410446',
						publicKey: '2121257F481EBAB9000D10BDEDB5670EEF83D4AEA552BDC208B55F619752F777',
						importance: '4500000000000000',
						mosaics: [
							{
								id: 'E74B99BA41F4AFEE',
								amount: '500000000'
							},
							{
								id: '85BBEA6CC462B244',
								amount: '25'
							}
						],
						supplementalPublicKeys: {
							linked: {
								publicKey: 'E16D2700853345E7A565F35AFB195C4CF19602B64BCE47BC375F3DA353AE04D9'
							}
						}
					}
				}
			],
			pagination: {
				pageNumber: 2,
				pageSize: 1
			}
		};
		makeRequest.mockResolvedValue(response);

		// Act:
		const result = await fetchAccountPage({
			order: 'asc',
			pageNumber: 2,
			pageSize: 25
		});

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/accounts?pageNumber=2&pageSize=25&order=asc');
		expect(result).toEqual({
			data: [
				{
					remoteAddress: null,
					address: 'TAJQRMZSC5I32SO7KZ6CVEUISO5T7EEXVI2UVBA',
					publicKey: '2121257F481EBAB9000D10BDEDB5670EEF83D4AEA552BDC208B55F619752F777',
					description: null,
					balance: 500,
					vestedBalance: 0,
					mosaics: [
						{
							name: 'XYM',
							id: 'E74B99BA41F4AFEE',
							amount: 500,
							isCreatedByAccount: false
						},
						{
							name: '85BBEA6CC462B244',
							id: '85BBEA6CC462B244',
							amount: 0.000025,
							isCreatedByAccount: false
						}
					],
					importance: 50,
					harvestedBlocks: null,
					harvestedFees: null,
					height: 3410446,
					minCosignatories: 0,
					cosignatoryOf: [],
					cosignatories: [],
					isMultisig: false,
					isHarvestingActive: true
				}
			],
			pageNumber: 2
		});
	});

	it('maps Symbol account info responses with zero public keys and missing mosaics', async () => {
		// Arrange:
		const { makeRequest } = require('@/utils/server');
		const { fetchAccountInfo, fetchAccountInfoByPublicKey } = require('@/variants/symbol/api/accounts');
		const response = {
			account: {
				address: '98EC86FADAAEAACDC3C4119003D4547BF95119602B48D374',
				publicKey: '0000000000000000000000000000000000000000000000000000000000000000'
			}
		};
		makeRequest.mockResolvedValue(response);

		// Act:
		const accountByAddress = await fetchAccountInfo('TDWINDW2V2VM3Q6ECDIAHVKUPP4VCGLAFNE5G5A');
		const accountByPublicKey = await fetchAccountInfoByPublicKey('0000000000000000000000000000000000000000000000000000000000000000');

		// Assert:
		expect(makeRequest).toHaveBeenNthCalledWith(1, '/api/symbol-node/accounts/TDWINDW2V2VM3Q6ECDIAHVKUPP4VCGLAFNE5G5A');
		expect(makeRequest).toHaveBeenNthCalledWith(
			2,
			'/api/symbol-node/accounts/0000000000000000000000000000000000000000000000000000000000000000'
		);
		expect(accountByAddress).toMatchObject({
			address: 'TDWIN6W2V2VM3Q6ECGIAHVCUPP4VCGLAFNENG5A',
			publicKey: null,
			balance: 0,
			mosaics: [],
			importance: 0,
			height: null,
			isHarvestingActive: false
		});
		expect(accountByPublicKey).toEqual(accountByAddress);
	});
});
