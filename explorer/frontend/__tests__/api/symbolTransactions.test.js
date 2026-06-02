import config from '@/config';
import * as utils from '@/utils/server';
import { namespaceIdFromName } from '@/variants/symbol/api/namespaces';
import {
	fetchTransactionInfo,
	fetchTransactionPage,
	normalizeTransactionDetail,
	resolveTransactionBlockSearch,
	resolveTransactionMosaicSearch,
	resolveTransactionRecipientSearch,
	resolveTransactionSignerSearch
} from '@/variants/symbol/api/transactions';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/transactions', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
		config.SYMBOL_EPOCH_ADJUSTMENT = 1615853185;
		config.SYMBOL_NETWORK_IDENTIFIER = 152;
		config.NATIVE_MOSAIC_ID = '72C0212E67A08BCE';
		config.NATIVE_MOSAIC_TICKER = 'XYM';
		config.NATIVE_MOSAIC_DIVISIBILITY = 6;
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
		jest.restoreAllMocks();
	});

	describe('fetchTransactionPage', () => {
		it('maps Symbol transaction type ids to transaction type names', async () => {
			// Arrange:
			const expectedTypeMappings = [
				[16716, 'ACCOUNT_KEY_LINK'],
				[16972, 'NODE_KEY_LINK'],
				[16705, 'AGGREGATE_COMPLETE'],
				[16961, 'AGGREGATE_BONDED'],
				[16707, 'VOTING_KEY_LINK'],
				[16963, 'VRF_KEY_LINK'],
				[16712, 'HASH_LOCK'],
				[16722, 'SECRET_LOCK'],
				[16978, 'SECRET_PROOF'],
				[16708, 'ACCOUNT_METADATA'],
				[16964, 'MOSAIC_METADATA'],
				[17220, 'NAMESPACE_METADATA'],
				[16717, 'MOSAIC_DEFINITION'],
				[16973, 'MOSAIC_SUPPLY_CHANGE'],
				[17229, 'MOSAIC_SUPPLY_REVOCATION'],
				[16725, 'MULTISIG_ACCOUNT_MODIFICATION'],
				[16974, 'ADDRESS_ALIAS'],
				[17230, 'MOSAIC_ALIAS'],
				[16718, 'NAMESPACE_REGISTRATION'],
				[16720, 'ACCOUNT_ADDRESS_RESTRICTION'],
				[16976, 'ACCOUNT_MOSAIC_RESTRICTION'],
				[17232, 'ACCOUNT_OPERATION_RESTRICTION'],
				[16977, 'MOSAIC_ADDRESS_RESTRICTION'],
				[16721, 'MOSAIC_GLOBAL_RESTRICTION'],
				[16724, 'TRANSFER']
			];
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: expectedTypeMappings.map(([type]) => ({
					meta: {
						hash: `HASH_${type}`,
						height: '1234'
					},
					transaction: {
						deadline: '1000',
						maxFee: '0',
						signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
						type
					}
				}))
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data.map(transaction => transaction.type)).toEqual(expectedTypeMappings.map(([, typeName]) => typeName));
		});

		it.each([
			['TRANSFER', ['16724']],
			['ACCOUNT', ['16974', '16725', '16720', '16976', '17232', '16716', '16708', '16707', '16963', '16972']],
			['AGGREGATE', ['16705', '16961', '16712']],
			['ALIAS', ['16974', '17230']],
			['METADATA', ['16708', '16964', '17220']],
			['MOSAIC', ['17230', '16717', '16973', '17229', '16977', '16721', '16964']],
			['NAMESPACE', ['16718', '17220']],
			['RESTRICTION', ['16720', '16976', '17232', '16977', '16721']],
			['SECRET', ['16722', '16978']],
			['KEY_LINK', ['16716', '16972', '16707', '16963']]
		])('maps "%s" transaction type filter to Symbol REST type ids', async (typeFilter, typeCodes) => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: []
			});

			// Act:
			await fetchTransactionPage({
				pageNumber: 3,
				pageSize: 25,
				types: typeFilter
			});

			// Assert:
			const typeQuery = typeCodes.map(typeCode => `type=${typeCode}`).join('&');
			const expectedURL = `/api/symbol-node/transactions/confirmed?pageNumber=3&pageSize=25&order=desc&orderBy=id&${typeQuery}`;

			expect(makeRequest).toHaveBeenCalledWith(expectedURL);
		});

		it('maps signer public key to sender address when signer address is absent', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: '5A9D',
							height: '1234'
						},
						transaction: {
							deadline: '1000',
							maxFee: '123456',
							mosaics: [
								{
									id: '72C0212E67A08BCE',
									amount: '987654'
								}
							],
							recipientAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							signerPublicKey: 'B'.repeat(64),
							type: 16724
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage({
				pageNumber: 2,
				pageSize: 50
			});

			// Assert:
			const expectedURL = '/api/symbol-node/transactions/confirmed?pageNumber=2&pageSize=50&order=desc&orderBy=id';

			expect(makeRequest).toHaveBeenCalledWith(expectedURL);
			expect(result.data[0]).toEqual({
				hash: '5A9D',
				height: 1234,
				type: 'TRANSFER',
				sender: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				recipient: 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ',
				value: [
					{
						id: '72C0212E67A08BCE',
						name: 'XYM',
						amount: 0.987654
					}
				],
				amount: 0.987654,
				fee: 0.123456,
				timestamp: '2021-03-16T00:06:26.000Z',
				message: ''
			});
			expect(result.pageNumber).toBe(2);
		});

		it('maps Symbol alias actions for alias transactions', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'ADDRESS_ALIAS_HASH',
							height: '1234'
						},
						transaction: {
							aliasAction: 1,
							deadline: '1000',
							maxFee: '0',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16974
						}
					},
					{
						meta: {
							hash: 'MOSAIC_ALIAS_HASH',
							height: '1234'
						},
						transaction: {
							aliasAction: 0,
							deadline: '1000',
							maxFee: '0',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 17230
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data).toEqual(expect.arrayContaining([
				expect.objectContaining({
					type: 'ADDRESS_ALIAS',
					aliasAction: 'link'
				}),
				expect.objectContaining({
					type: 'MOSAIC_ALIAS',
					aliasAction: 'unlink'
				})
			]));
		});

		it('maps Symbol link actions for account, node, voting and VRF key link transactions', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'ACCOUNT_KEY_LINK_HASH',
							height: '1234'
						},
						transaction: {
							deadline: '1000',
							linkAction: 1,
							maxFee: '0',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16716
						}
					},
					{
						meta: {
							hash: 'NODE_KEY_LINK_HASH',
							height: '1234'
						},
						transaction: {
							deadline: '1000',
							linkAction: 0,
							maxFee: '0',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16972
						}
					},
					{
						meta: {
							hash: 'VOTING_KEY_LINK_HASH',
							height: '1234'
						},
						transaction: {
							deadline: '1000',
							linkAction: 1,
							maxFee: '0',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16707
						}
					},
					{
						meta: {
							hash: 'VRF_KEY_LINK_HASH',
							height: '1234'
						},
						transaction: {
							deadline: '1000',
							linkAction: 0,
							maxFee: '0',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16963
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data).toEqual(expect.arrayContaining([
				expect.objectContaining({
					type: 'ACCOUNT_KEY_LINK',
					linkAction: 'link'
				}),
				expect.objectContaining({
					type: 'NODE_KEY_LINK',
					linkAction: 'unlink'
				}),
				expect.objectContaining({
					type: 'VOTING_KEY_LINK',
					linkAction: 'link'
				}),
				expect.objectContaining({
					type: 'VRF_KEY_LINK',
					linkAction: 'unlink'
				})
			]));
		});

		it('maps Symbol Namespace Registration name and registration type', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'ROOT_NAMESPACE_HASH',
							height: '1234'
						},
						transaction: {
							deadline: '1000',
							id: '88A058DAA0940608',
							maxFee: '0',
							name: 'rootnamespace',
							registrationType: 0,
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16718
						}
					},
					{
						meta: {
							hash: 'SUB_NAMESPACE_HASH',
							height: '1234'
						},
						transaction: {
							deadline: '1000',
							id: 'A8A057CA90B40609',
							maxFee: '0',
							name: 'rootnamespace.subnamespace',
							registrationType: 1,
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16718
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data).toEqual(expect.arrayContaining([
				expect.objectContaining({
					type: 'NAMESPACE_REGISTRATION',
					namespaceRegistration: {
						id: '88A058DAA0940608',
						name: 'rootnamespace',
						registrationType: 'root'
					}
				}),
				expect.objectContaining({
					type: 'NAMESPACE_REGISTRATION',
					namespaceRegistration: {
						id: 'A8A057CA90B40609',
						name: 'rootnamespace.subnamespace',
						registrationType: 'sub'
					}
				})
			]));
		});

		it('labels only the configured native mosaic as XYM', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'XYM_ALIAS_HASH',
							height: '2345'
						},
						transaction: {
							deadline: '1000',
							maxFee: '0',
							mosaics: [
								{
									id: '72C0212E67A08BCE',
									amount: '1234567'
								},
								{
									id: '1234567890ABCDEF',
									amount: '7654321'
								}
							],
							recipientAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16724
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0].value).toEqual([
				{
					id: '72C0212E67A08BCE',
					name: 'XYM',
					amount: 1.234567
				},
				{
					id: '1234567890ABCDEF',
					name: '1234567890ABCDEF',
					amount: 7.654321
				}
			]);
			expect(result.data[0].amount).toBe(1.234567);
		});

		it('maps Symbol HashLock mosaic to transaction value', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'HASH_LOCK_HASH',
							height: '3456'
						},
						transaction: {
							deadline: '1000',
							maxFee: '1000',
							mosaicId: '72C0212E67A08BCE',
							amount: '10000000',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16712
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0]).toEqual(expect.objectContaining({
				type: 'HASH_LOCK',
				value: [
					{
						id: '72C0212E67A08BCE',
						name: 'XYM',
						amount: 10
					}
				],
				amount: 10
			}));
		});

		it('maps Symbol Mosaic Definition id to transaction value without resolving name', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'MOSAIC_DEFINITION_HASH',
							height: '3396027'
						},
						transaction: {
							deadline: '112167591606',
							id: '640E1E8507E8C16B',
							maxFee: '15000',
							signerPublicKey: 'AD81888E66B59A8DB2BA4F45A3352DD6781E49179DFFF103E9B04D7030C934A2',
							type: 16717
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0]).toEqual(expect.objectContaining({
				type: 'MOSAIC_DEFINITION',
				value: [
					{
						id: '640E1E8507E8C16B',
						name: '640E1E8507E8C16B',
						amount: null
					}
				],
				amount: 0
			}));
		});

		it('maps Symbol Mosaic Global Restriction mosaic id to transaction value without resolving name', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'MOSAIC_GLOBAL_RESTRICTION_HASH',
							height: '3386443'
						},
						transaction: {
							deadline: '111878660598',
							maxFee: '17000',
							mosaicId: '5DE7C2689DEA6B02',
							signerPublicKey: 'C8398D12E27B7E99AF1467BF6E1D390A6225815A9F1378D5C964D6BD4B5AD0FC',
							type: 16721
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0]).toEqual(expect.objectContaining({
				type: 'MOSAIC_GLOBAL_RESTRICTION',
				value: [
					{
						id: '5DE7C2689DEA6B02',
						name: '5DE7C2689DEA6B02',
						amount: null
					}
				],
				amount: 0
			}));
		});

		it('maps Symbol Mosaic Supply Revocation mosaic id to transaction value without resolving name', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'MOSAIC_SUPPLY_REVOCATION_HASH',
							height: '3389261'
						},
						transaction: {
							deadline: '111964313206',
							maxFee: '16800',
							mosaicId: '4E806F3E44AC0FCB',
							signerPublicKey: '721D9ACD9070737382B11B2A1F8FF04374F42B9F190A8015B207A225BD1C462F',
							type: 17229
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0]).toEqual(expect.objectContaining({
				type: 'MOSAIC_SUPPLY_REVOCATION',
				value: [
					{
						id: '4E806F3E44AC0FCB',
						name: '4E806F3E44AC0FCB',
						amount: null
					}
				],
				amount: 0
			}));
		});

		it.each([
			[1, 'increase'],
			[0, 'decrease']
		])('maps Symbol Mosaic Supply Change action %s to %s', async (action, expectedSupplyAction) => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: `MOSAIC_SUPPLY_CHANGE_${action}_HASH`,
							height: '3396029'
						},
						transaction: {
							action,
							deadline: '112167651813',
							maxFee: '14500',
							mosaicId: '640E1E8507E8C16B',
							signerPublicKey: 'AD81888E66B59A8DB2BA4F45A3352DD6781E49179DFFF103E9B04D7030C934A2',
							type: 16973
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0]).toEqual(expect.objectContaining({
				type: 'MOSAIC_SUPPLY_CHANGE',
				supplyAction: expectedSupplyAction
			}));
		});

		it('maps Symbol Secret Proof proof to transaction info', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'SECRET_PROOF_HASH',
							height: '3401767'
						},
						transaction: {
							deadline: '112340172026',
							maxFee: '21500',
							proof: '636F727265637420686F727365206261747465727920737461706C65',
							recipientAddress: '985CF90EB04886CCA5371699A3AD806F6F23A91364384DAE',
							signerPublicKey: 'E82A139FF777CA8CC54204FC9857A3FF4DC29ABC3640268E734243A34A6BDD9C',
							type: 16978
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0]).toEqual(expect.objectContaining({
				type: 'SECRET_PROOF',
				proof: '636F727265637420686F727365206261747465727920737461706C65'
			}));
		});

		it('maps Symbol Secret Lock secret to transaction info', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'SECRET_LOCK_HASH',
							height: '3395349'
						},
						transaction: {
							deadline: '112147307149',
							maxFee: '20900',
							recipientAddress: '98FD2BC73EE53A7C194E11194FA98DC0A5FF662B5A8370B8',
							secret: 'B867DB875479BCC0287352CDAA4A1755689B8338777D0915E9ACD9F6EDBC96CB',
							signerPublicKey: '6C1E810D9632F654C0B6215B3D13130C233F1AB1962ADA5DAF9E226130EAE7B6',
							type: 16722
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0]).toEqual(expect.objectContaining({
				type: 'SECRET_LOCK',
				secret: 'B867DB875479BCC0287352CDAA4A1755689B8338777D0915E9ACD9F6EDBC96CB'
			}));
		});

		it('maps Symbol Account Mosaic Restriction addition and deletion counts to transaction info', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'ACCOUNT_MOSAIC_RESTRICTION_HASH',
							height: '3389391'
						},
						transaction: {
							deadline: '111968214662',
							maxFee: '15200',
							restrictionAdditions: ['1111111111111111'],
							restrictionDeletions: ['E74B99BA41F4AFEE', '066067F5C661DBE5'],
							signerPublicKey: '5DBA41C479048EF80F1D5A5CE29093A4C7418056DDF6FFB6627110AFDC5D1513',
							type: 16976
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0]).toEqual(expect.objectContaining({
				type: 'ACCOUNT_MOSAIC_RESTRICTION',
				restrictionAction: {
					added: 1,
					removed: 2
				}
			}));
		});

		it('maps Symbol Account Address Restriction addition and deletion counts to transaction info', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'ACCOUNT_ADDRESS_RESTRICTION_HASH',
							height: '3371870'
						},
						transaction: {
							deadline: '111439456088',
							maxFee: '16000',
							restrictionAdditions: [],
							restrictionDeletions: ['987D075454716222F609929E883174AD8C996D5828C938BC'],
							signerPublicKey: '3B6A27BCCEB6A42D62A3A8D02A6F0D73653215771DE243A63AC048A18B59DA29',
							type: 16720
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0]).toEqual(expect.objectContaining({
				type: 'ACCOUNT_ADDRESS_RESTRICTION',
				restrictionAction: {
					added: 0,
					removed: 1
				}
			}));
		});

		it('maps Symbol Account Operation Restriction addition and deletion counts to transaction info', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'ACCOUNT_OPERATION_RESTRICTION_HASH',
							height: '3389391'
						},
						transaction: {
							deadline: '111968214662',
							maxFee: '15200',
							restrictionAdditions: [16724, 16712],
							restrictionDeletions: [16978],
							signerPublicKey: '5DBA41C479048EF80F1D5A5CE29093A4C7418056DDF6FFB6627110AFDC5D1513',
							type: 17232
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0]).toEqual(expect.objectContaining({
				type: 'ACCOUNT_OPERATION_RESTRICTION',
				restrictionAction: {
					added: 2,
					removed: 1
				}
			}));
		});

		it.each([
			[
				'plain message string payload',
				'0048656C6C6F2053796D626F6C',
				{
					type: 'plain',
					text: 'Hello Symbol'
				}
			],
			[
				'plain message',
				{
					payload: '0048656C6C6F2053796D626F6C'
				},
				{
					type: 'plain',
					text: 'Hello Symbol'
				}
			],
			[
				'encrypted message',
				{
					payload: '0123456789ABCDEF'
				},
				{
					type: 'encrypted'
				}
			],
			[
				'delegated harvesting persistent message',
				{
					payload: `FE2A8061577301E2${'A'.repeat(248)}`
				},
				{
					type: 'delegatedHarvestingPersistent',
					text: `FE2A8061577301E2${'A'.repeat(248)}`
				}
			]
		])('normalizes Symbol %s DTO for transaction list display', async (label, message, expectedMessage) => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'MESSAGE_HASH',
							height: '1234'
						},
						transaction: {
							deadline: '1000',
							maxFee: '0',
							message,
							recipientAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16724
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0].message).toEqual(expectedMessage);
		});

		it('returns no message when payload is empty', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'MESSAGE_HASH',
							height: '1234'
						},
						transaction: {
							deadline: '1000',
							maxFee: '0',
							message: {
								payload: ''
							},
							recipientAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16724
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0].message).toBe('');
		});

		it.each(['00', '01'])('returns no message when payload is only the %s marker byte', async payload => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'MESSAGE_HASH',
							height: '1234'
						},
						transaction: {
							deadline: '1000',
							maxFee: '0',
							message: {
								payload
							},
							recipientAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16724
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0].message).toBe('');
		});

		it('normalizes raw message payload to a HEX display message', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							hash: 'MESSAGE_HASH',
							height: '1234'
						},
						transaction: {
							deadline: '1000',
							maxFee: '0',
							message: {
								payload: 'FF1234'
							},
							recipientAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
							type: 16724
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage();

			// Assert:
			expect(result.data[0].message).toEqual({
				type: 'raw',
				text: 'FF1234'
			});
		});

		it('maps to filter to Symbol REST recipientAddress query parameter', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: []
			});

			// Act:
			await fetchTransactionPage({
				pageNumber: 2,
				pageSize: 50,
				to: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY'
			});

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/transactions/confirmed?pageNumber=2&pageSize=50&order=desc'
					+ '&orderBy=id&recipientAddress=TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY');
		});

		it('maps from public key filter to Symbol REST signerPublicKey query parameter', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: []
			});

			// Act:
			await fetchTransactionPage({
				pageNumber: 2,
				pageSize: 50,
				from: 'B'.repeat(64)
			});

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/transactions/confirmed?pageNumber=2&pageSize=50&order=desc'
					+ `&orderBy=id&signerPublicKey=${'B'.repeat(64)}`);
		});

		it('passes block height filter to Symbol REST height query parameter', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: []
			});

			// Act:
			await fetchTransactionPage({
				pageNumber: 2,
				pageSize: 50,
				height: '123456'
			});

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/transactions/confirmed?pageNumber=2&pageSize=50&order=desc'
					+ '&orderBy=id&height=123456');
		});

		it('maps mosaic filter to Symbol REST transferMosaicId query parameter', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: []
			});

			// Act:
			await fetchTransactionPage({
				pageNumber: 2,
				pageSize: 50,
				mosaic: '72C0212E67A08BCE',
				mosaicDivisibility: 6
			});

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/transactions/confirmed?pageNumber=2&pageSize=50&order=desc'
					+ '&orderBy=id&transferMosaicId=72C0212E67A08BCE&embedded=true');
		});

		it('maps embedded mosaic transfer aggregate hash to transaction hash', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						meta: {
							aggregateHash: '7A02C84BFA2780677EAA1E8CC5DC479CA689088AD02CAB4A42BBDA3583507094',
							height: '3407535'
						},
						transaction: {
							signerPublicKey: 'D37854BE384C56C444E0CFA4C962706408DCD58A03373BC350A4D56249D7A7F5',
							type: 16724,
							recipientAddress: '98DF870BFA637FB4BC09B95605CF3BF0C23A5C1D42A4D88B',
							mosaics: [
								{
									id: '6F7904E6DF09D21D',
									amount: '100'
								}
							]
						}
					}
				]
			});

			// Act:
			const result = await fetchTransactionPage({
				mosaic: '6F7904E6DF09D21D',
				mosaicDivisibility: 2
			});

			// Assert:
			expect(result.data[0]).toEqual(expect.objectContaining({
				hash: '7A02C84BFA2780677EAA1E8CC5DC479CA689088AD02CAB4A42BBDA3583507094',
				height: 3407535,
				type: 'TRANSFER',
				value: [
					{
						id: '6F7904E6DF09D21D',
						name: '6F7904E6DF09D21D',
						amount: 1
					}
				]
			}));
		});
	});

	describe('fetchTransactionInfo', () => {
		const hash = 'A'.repeat(64);
		const signerPublicKey = 'B'.repeat(64);
		const signature = 'C'.repeat(128);

		it('does not call the node for an invalid hash', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');

			// Act:
			const result = await fetchTransactionInfo('INVALID_HASH');

			// Assert:
			expect(result).toBeNull();
			expect(makeRequest).not.toHaveBeenCalled();
		});

		it('uses confirmed endpoint and effective fee for confirmed transactions', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest
				.mockResolvedValueOnce({ group: 'confirmed', code: 'Success', hash })
				.mockResolvedValueOnce({
					meta: {
						hash,
						height: '123'
					},
					transaction: {
						deadline: '1000',
						maxFee: '999999',
						signature,
						signerPublicKey,
						size: 100,
						type: 16724,
						version: 1
					}
				})
				.mockResolvedValueOnce({
					block: {
						feeMultiplier: 25,
						timestamp: '2000'
					}
				});

			// Act:
			const result = await fetchTransactionInfo(hash);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, `/api/symbol-node/transactionStatus/${hash}`);
			expect(makeRequest).toHaveBeenNthCalledWith(2, `/api/symbol-node/transactions/confirmed/${hash}`);
			expect(makeRequest).toHaveBeenNthCalledWith(3, '/api/symbol-node/blocks/123');
			expect(result.group).toBe('confirmed');
			expect(result.info.effectiveFee).toBe(0.0025);
			expect(result.info.maxFee).toBeNull();
		});

		it('uses unconfirmed endpoint and max fee for unconfirmed transactions', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest
				.mockResolvedValueOnce({ group: 'unconfirmed', code: 'Success', hash })
				.mockResolvedValueOnce({
					meta: {
						hash
					},
					transaction: {
						deadline: '1000',
						maxFee: '1500000',
						signature,
						signerPublicKey,
						type: 16724,
						version: 1
					}
				});

			// Act:
			const result = await fetchTransactionInfo(hash);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, `/api/symbol-node/transactionStatus/${hash}`);
			expect(makeRequest).toHaveBeenNthCalledWith(2, `/api/symbol-node/transactions/unconfirmed/${hash}`);
			expect(result.group).toBe('unconfirmed');
			expect(result.info.effectiveFee).toBeNull();
			expect(result.info.maxFee).toBe(1.5);
		});

		it('fetches mosaic divisibility for mosaic supply revocation transaction detail', async () => {
			// Arrange:
			const mosaicId = '4E806F3E44AC0FCB';
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest
				.mockResolvedValueOnce({ group: 'confirmed', code: 'Success', hash })
				.mockResolvedValueOnce({
					meta: {
						hash,
						height: '123'
					},
					transaction: {
						amount: '12345',
						deadline: '1000',
						maxFee: '999999',
						mosaicId,
						signature,
						signerPublicKey,
						sourceAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
						type: 17229,
						version: 1
					}
				})
				.mockResolvedValueOnce({
					block: {
						feeMultiplier: 25,
						timestamp: '2000'
					}
				})
				.mockResolvedValueOnce({
					mosaic: {
						divisibility: 2,
						id: mosaicId
					}
				});

			// Act:
			const result = await fetchTransactionInfo(hash);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(4, `/api/symbol-node/mosaics/${mosaicId}`);
			expect(result.detail.mosaics[0].amount).toBe(123.45);
			expect(result.graphic.transactions[0].mosaics[0].amount).toBe(123.45);
		});

		it('requests hash lock only for aggregate bonded transactions', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest
				.mockResolvedValueOnce({ group: 'partial', code: 'Success', hash })
				.mockResolvedValueOnce({
					meta: {
						hash
					},
					transaction: {
						cosignatures: [
							{
								signature,
								signerPublicKey
							}
						],
						deadline: '1000',
						maxFee: '2000000',
						signature,
						signerPublicKey,
						transactions: [
							{
								signerPublicKey,
								type: 16724
							}
						],
						type: 16961,
						version: 1
					}
				})
				.mockResolvedValueOnce({
					lock: {
						amount: '10000000',
						endHeight: '456',
						mosaicId: '72C0212E67A08BCE',
						ownerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
						status: 0
					}
				});

			// Act:
			const result = await fetchTransactionInfo(hash);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(2, `/api/symbol-node/transactions/partial/${hash}`);
			expect(makeRequest).toHaveBeenNthCalledWith(3, `/api/symbol-node/lock/hash/${hash}`);
			expect(result.detail.transactionType).toBe('AGGREGATE_BONDED');
			expect(result.aggregate.innerTransactions).toHaveLength(1);
			expect(result.aggregate.cosignatures).toHaveLength(1);
			expect(result.hashLock.endHeight).toBe(456);
		});

		it('does not request hash lock for aggregate complete transactions', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest
				.mockResolvedValueOnce({ group: 'confirmed', code: 'Success', hash })
				.mockResolvedValueOnce({
					meta: {
						hash,
						height: '789',
						feeMultiplier: 1
					},
					transaction: {
						deadline: '1000',
						maxFee: '2000000',
						signature,
						signerPublicKey,
						size: 100,
						transactions: [],
						type: 16705,
						version: 1
					}
				})
				.mockResolvedValueOnce({
					block: {
						timestamp: '2000'
					}
				});

			// Act:
			const result = await fetchTransactionInfo(hash);

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(3);
			expect(result.detail.transactionType).toBe('AGGREGATE_COMPLETE');
			expect(result.hashLock).toBeUndefined();
		});

		it('resolves missing address alias namespace name for transaction detail', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest
				.mockResolvedValueOnce({ group: 'confirmed', code: 'Success', hash })
				.mockResolvedValueOnce({
					meta: {
						hash,
						height: '123'
					},
					transaction: {
						address: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
						aliasAction: 1,
						deadline: '1000',
						maxFee: '999999',
						namespaceId: 'D47D7DC85A201C13',
						signature,
						signerPublicKey,
						type: 16974,
						version: 1
					}
				})
				.mockResolvedValueOnce({
					block: {
						feeMultiplier: 25,
						timestamp: '2000'
					}
				})
				.mockResolvedValueOnce([
					{
						id: 'D47D7DC85A201C13',
						name: 'alias.name'
					}
				]);

			// Act:
			const result = await fetchTransactionInfo(hash);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(4, '/api/symbol-node/namespaces/names', {
				method: 'POST',
				body: JSON.stringify({
					namespaceIds: ['D47D7DC85A201C13']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result.detail.namespaceName).toBe('alias.name');
			expect(result.graphic.transactions[0].namespaceName).toBe('alias.name');
		});

		it('resolves missing namespace metadata namespace name for transaction detail', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest
				.mockResolvedValueOnce({ group: 'confirmed', code: 'Success', hash })
				.mockResolvedValueOnce({
					meta: {
						hash,
						height: '123'
					},
					transaction: {
						deadline: '1000',
						maxFee: '999999',
						scopedMetadataKey: 'BB3026E7612A769F',
						signature,
						signerPublicKey,
						targetNamespaceId: '85BBEA6CC462B244',
						type: 17220,
						value: 'namespace metadata',
						valueSizeDelta: 18,
						version: 1
					}
				})
				.mockResolvedValueOnce({
					block: {
						feeMultiplier: 25,
						timestamp: '2000'
					}
				})
				.mockResolvedValueOnce([
					{
						id: '85BBEA6CC462B244',
						name: 'root.namespace'
					}
				]);

			// Act:
			const result = await fetchTransactionInfo(hash);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(4, '/api/symbol-node/namespaces/names', {
				method: 'POST',
				body: JSON.stringify({
					namespaceIds: ['85BBEA6CC462B244']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result.detail.namespaceName).toBe('root.namespace');
			expect(result.graphic.transactions[0].namespaceName).toBe('root.namespace');
		});

		it('omits undefined optional properties from the server-side view model', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest
				.mockResolvedValueOnce({ group: 'partial', code: 'Success', hash })
				.mockResolvedValueOnce({
					meta: {
						hash
					},
					transaction: {
						deadline: '1000',
						maxFee: '2000000',
						signature,
						signerPublicKey,
						transactions: [
							{
								signerPublicKey,
								type: 16724
							}
						],
						type: 16961,
						version: 1
					}
				})
				.mockResolvedValueOnce(null);

			// Act:
			const result = await fetchTransactionInfo(hash);

			// Assert:
			const firstGraphic = result.aggregate.innerTransactions[0].graphic;

			expect(Object.prototype.hasOwnProperty.call(firstGraphic, 'recipient')).toBe(false);
			expect(Object.prototype.hasOwnProperty.call(firstGraphic, 'message')).toBe(false);
			expect(JSON.parse(JSON.stringify(result))).toEqual(result);
		});
	});

	describe('normalizeTransactionDetail', () => {
		it('includes transactionType in voting key link detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						endEpoch: 100,
						linkAction: 1,
						linkedPublicKey: 'D'.repeat(64),
						signerPublicKey: 'B'.repeat(64),
						startEpoch: 10,
						type: 16707,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'VOTING_KEY_LINK',
				linkAction: 'link',
				linkedPublicKey: 'D'.repeat(64),
				startEpoch: 10,
				endEpoch: 100
			}));
		});

		it.each([
			[16716, 'ACCOUNT_KEY_LINK'],
			[16972, 'NODE_KEY_LINK'],
			[16707, 'VOTING_KEY_LINK'],
			[16963, 'VRF_KEY_LINK']
		])('uses linked account address as %s graphic target account', (type, transactionType) => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						endEpoch: 100,
						linkAction: 1,
						linkedPublicKey: 'D'.repeat(64),
						signerAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
						startEpoch: 10,
						type,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType,
				address: result.detail.linkedAccountAddress
			}));
			expect(result.graphic.transactions[0].targetAccount).toBe(result.detail.linkedAccountAddress);
			expect(result.detail.linkedAccountAddress).not.toBe(result.info.signer);
			expect(result.graphic.transactions[0].startEpoch).toBe(10);
			expect(result.graphic.transactions[0].endEpoch).toBe(100);
		});

		it('maps hash lock hash and lock duration into transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						amount: '10000000',
						duration: '480',
						hash: 'B'.repeat(64),
						mosaicId: '72C0212E67A08BCE',
						signerPublicKey: 'C'.repeat(64),
						type: 16712,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'HASH_LOCK',
				duration: '480',
				hash: 'B'.repeat(64)
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				type: 'HASH_LOCK',
				duration: '480',
				hash: 'B'.repeat(64),
				lockDuration: '480'
			}));
		});

		it('maps multisig account modification approval and removal deltas into transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						addressAdditions: ['98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26'],
						addressDeletions: ['985F83583B77AB88E212A025B0C707963C092D0A02A625CA'],
						minApprovalDelta: 2,
						minRemovalDelta: 3,
						signerPublicKey: 'B'.repeat(64),
						type: 16725,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'MULTISIG_ACCOUNT_MODIFICATION',
				minApprovalDelta: 2,
				minRemovalDelta: 3,
				addressAdditions: ['TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ'],
				addressDeletions: ['TBPYGWB3O6VYRYQSUAS3BRYHSY6ASLIKAKTCLSQ']
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				type: 'MULTISIG_ACCOUNT_MODIFICATION',
				minApprovalDelta: 2,
				minRemovalDelta: 3,
				cosignatoryAdditions: ['TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ'],
				cosignatoryDeletions: ['TBPYGWB3O6VYRYQSUAS3BRYHSY6ASLIKAKTCLSQ']
			}));
			expect(result.graphic.transactions[0]).not.toHaveProperty('minCosignatories');
		});

		it('maps address alias target address and namespace fields into transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						address: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
						aliasAction: 1,
						namespaceId: 'D47D7DC85A201C13',
						namespaceName: 'alias.name',
						signerPublicKey: 'B'.repeat(64),
						type: 16974,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'ADDRESS_ALIAS',
				address: result.graphic.transactions[0].recipient,
				namespaceId: 'D47D7DC85A201C13',
				namespaceName: 'alias.name'
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				aliasAction: 'link',
				namespaceId: 'D47D7DC85A201C13',
				namespaceName: 'alias.name'
			}));
		});

		it('maps namespace registration namespace name to transaction graphic sink', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						duration: '1000',
						id: '88A058DAA0940608',
						name: 'rootnamespace.subnamespace',
						parentId: '88A058DAA0940608',
						registrationType: 1,
						rentalFeeSink: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
						signerPublicKey: 'B'.repeat(64),
						type: 16718,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'NAMESPACE_REGISTRATION',
				namespaceId: '88A058DAA0940608',
				namespaceName: 'rootnamespace.subnamespace',
				parentId: '88A058DAA0940608',
				duration: '1000'
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				recipient: undefined,
				targetNamespace: {
					id: '88A058DAA0940608',
					name: 'rootnamespace.subnamespace'
				},
				parentId: '88A058DAA0940608',
				duration: '1000'
			}));
		});

		it('maps account address restriction target and restriction fields into transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						restrictionAdditions: ['98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26'],
						restrictionDeletions: [],
						restrictionFlags: 32769,
						signerPublicKey: 'B'.repeat(64),
						type: 16720,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'ACCOUNT_ADDRESS_RESTRICTION',
				restrictionType: 'Block Incoming Address',
				restrictionAddressAdditions: ['TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ']
			}));
			expect(result.detail).not.toHaveProperty('restrictionMosaicAdditions');
			expect(result.detail).not.toHaveProperty('restrictionOperationAdditions');
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				targetAccount: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				restrictionType: 'Block Incoming Address',
				restrictionAddressAdditions: ['TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ']
			}));
		});

		it('maps account mosaic restriction target and restriction fields into transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						restrictionAdditions: ['72C0212E67A08BCE'],
						restrictionDeletions: [],
						restrictionFlags: 32770,
						signerPublicKey: 'B'.repeat(64),
						type: 16976,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'ACCOUNT_MOSAIC_RESTRICTION',
				restrictionType: 'Block Incoming Mosaic',
				restrictionMosaicAdditions: ['72C0212E67A08BCE']
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				targetAccount: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				restrictionType: 'Block Incoming Mosaic',
				restrictionMosaicAdditions: ['72C0212E67A08BCE']
			}));
		});

		it('maps account operation restriction target and enum values into transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						restrictionAdditions: [16724, 16712],
						restrictionDeletions: [16978],
						restrictionFlags: 32772,
						signerPublicKey: 'B'.repeat(64),
						type: 17232,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'ACCOUNT_OPERATION_RESTRICTION',
				restrictionType: 'Block Incoming Operation',
				restrictionOperationAdditions: ['TRANSFER', 'HASH_LOCK'],
				restrictionOperationDeletions: ['SECRET_PROOF']
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				targetAccount: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				restrictionType: 'Block Incoming Operation',
				restrictionOperationAdditions: ['TRANSFER', 'HASH_LOCK'],
				restrictionOperationDeletions: ['SECRET_PROOF']
			}));
		});

		it('maps mosaic alias mosaic id into transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						aliasAction: 1,
						mosaicId: '72C0212E67A08BCE',
						namespaceId: 'D47D7DC85A201C13',
						namespaceName: 'alias.mosaic',
						signerPublicKey: 'B'.repeat(64),
						type: 17230,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'MOSAIC_ALIAS',
				mosaicId: '72C0212E67A08BCE',
				namespaceName: 'alias.mosaic'
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				aliasAction: 'link',
				mosaicId: '72C0212E67A08BCE',
				namespaceName: 'alias.mosaic'
			}));
		});

		it('maps mosaic definition flags to transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						divisibility: 6,
						duration: '0',
						flags: 14,
						id: '72C0212E67A08BCE',
						nonce: {
							value: 12345
						},
						signerPublicKey: 'B'.repeat(64),
						type: 16717,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'MOSAIC_DEFINITION',
				mosaicId: '72C0212E67A08BCE',
				divisibility: 6,
				duration: '0',
				nonce: 12345,
				supplyMutable: false,
				transferable: true,
				restrictable: true,
				revokable: true
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				targetMosaic: {
					id: '72C0212E67A08BCE',
					name: '72C0212E67A08BCE'
				},
				divisibility: 6,
				duration: '0',
				nonce: 12345,
				supplyMutable: false,
				transferable: true,
				restrictable: true,
				revokable: true
			}));
		});

		it('maps mosaic supply change action and delta to transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						action: 1,
						delta: '100',
						mosaicId: '72C0212E67A08BCE',
						signerPublicKey: 'B'.repeat(64),
						type: 16973,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'MOSAIC_SUPPLY_CHANGE',
				action: 'increase',
				delta: '100',
				mosaicId: '72C0212E67A08BCE'
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				targetMosaic: {
					id: '72C0212E67A08BCE',
					name: '72C0212E67A08BCE'
				},
				delta: '100',
				supplyAction: 1
			}));
		});

		it('maps mosaic supply revocation transaction graphic sender and recipient', () => {
			// Arrange:
			const mosaicId = '4E806F3E44AC0FCB';

			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				mosaicDivisibilityMap: {
					[mosaicId]: 2
				},
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						amount: '12345',
						mosaicId,
						signerPublicKey: 'B'.repeat(64),
						sourceAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
						type: 17229,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'MOSAIC_SUPPLY_REVOCATION',
				address: 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ',
				mosaics: [
					expect.objectContaining({
						mosaicId,
						amount: 123.45
					})
				]
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				sender: 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ',
				recipient: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				address: 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ',
				mosaics: [
					expect.objectContaining({
						id: mosaicId,
						amount: 123.45
					})
				]
			}));
		});

		it('maps mosaic address restriction transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						mosaicAliasNames: ['alias.mosaic'],
						mosaicId: '72C0212E67A08BCE',
						newRestrictionValue: '100',
						previousRestrictionValue: '0',
						restrictionKey: '123',
						signerPublicKey: 'B'.repeat(64),
						targetAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
						type: 16977,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'MOSAIC_ADDRESS_RESTRICTION',
				mosaicId: '72C0212E67A08BCE',
				mosaicAliasNames: ['alias.mosaic'],
				targetAddress: 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ'
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				targetMosaic: {
					id: '72C0212E67A08BCE',
					name: '72C0212E67A08BCE'
				},
				mosaicAliasNames: ['alias.mosaic'],
				targetAddress: 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ'
			}));
		});

		it('maps mosaic global restriction transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						mosaicId: '72C0212E67A08BCE',
						newRestrictionType: 6,
						newRestrictionValue: '100',
						previousRestrictionType: 0,
						previousRestrictionValue: '0',
						referenceMosaicId: '0000000000000000',
						restrictionKey: '123',
						signerPublicKey: 'B'.repeat(64),
						type: 16721,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'MOSAIC_GLOBAL_RESTRICTION',
				mosaicId: '72C0212E67A08BCE',
				referenceMosaicId: '72C0212E67A08BCE',
				previousRestrictionType: 'No Restriction',
				newRestrictionType: 'Greater Than Or Equal'
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				targetMosaic: {
					id: '72C0212E67A08BCE',
					name: '72C0212E67A08BCE'
				},
				referenceMosaicId: '72C0212E67A08BCE',
				previousRestrictionType: 'No Restriction',
				newRestrictionType: 'Greater Than Or Equal'
			}));
		});

		it('keeps metadata text as escaped React text input data, not HTML', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						scopedMetadataKey: '1',
						signerPublicKey: 'B'.repeat(64),
						targetAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
						type: 16708,
						value: '<strong>metadata</strong>',
						valueSizeDelta: 8,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail.valueDelta).toBe('<strong>metadata</strong>');
			expect(result.graphic.transactions[0].targetAddress).toBe(result.detail.targetAddress);
			expect(result.graphic.transactions[0].scopedMetadataKey).toBe('1');
			expect(result.graphic.transactions[0].valueDelta).toBe('<strong>metadata</strong>');
			expect(result.graphic.transactions[0].valueSizeDelta).toBe(8);
		});

		it('maps mosaic metadata target mosaic and linked namespace names into transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						scopedMetadataKey: 'BB3026E7612A769F',
						signerPublicKey: 'B'.repeat(64),
						targetMosaicAliasNames: ['alias.mosaic'],
						targetMosaicId: '72C0212E67A08BCE',
						type: 16964,
						value: 'mosaic metadata',
						valueSizeDelta: 15,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'MOSAIC_METADATA',
				targetMosaicId: '72C0212E67A08BCE',
				targetMosaicAliasNames: ['alias.mosaic'],
				valueDelta: 'mosaic metadata',
				valueSizeDelta: 15
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				targetMosaic: {
					id: '72C0212E67A08BCE',
					name: '72C0212E67A08BCE'
				},
				targetMosaicAliasNames: ['alias.mosaic']
			}));
		});

		it('maps namespace metadata target namespace and name into transaction graphic detail', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						namespaceName: 'root.namespace',
						scopedMetadataKey: 'BB3026E7612A769F',
						signerPublicKey: 'B'.repeat(64),
						targetNamespaceId: '85BBEA6CC462B244',
						type: 17220,
						value: 'namespace metadata',
						valueSizeDelta: 18,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'NAMESPACE_METADATA',
				targetNamespaceId: '85BBEA6CC462B244',
				namespaceName: 'root.namespace',
				valueDelta: 'namespace metadata',
				valueSizeDelta: 18
			}));
			expect(result.graphic.transactions[0].targetNamespace).toEqual({
				id: '85BBEA6CC462B244',
				name: '85BBEA6CC462B244'
			});
			expect(result.graphic.transactions[0].namespaceName).toBe('root.namespace');
		});

		it('maps Secret Proof hash algorithm code to the existing display key', () => {
			// Act:
			const result = normalizeTransactionDetail({
				hash: 'A'.repeat(64),
				status: { group: 'confirmed', code: 'Success' },
				transactionDto: {
					meta: {
						hash: 'A'.repeat(64)
					},
					transaction: {
						hashAlgorithm: 2,
						proof: 'AEAA',
						recipientAddress: '98B61B0F19BC2E87B50DED3276F7F977942F284AEBA08C26',
						secret: '2F2929A09DA25C7E2412128955D0BF073B1C2AA08BB6F254DC5E7BF9C323CE9A',
						signerPublicKey: 'B'.repeat(64),
						type: 16978,
						version: 1
					}
				}
			});

			// Assert:
			expect(result.detail).toEqual(expect.objectContaining({
				transactionType: 'SECRET_PROOF',
				hashAlgorithm: 'hash256',
				proof: 'AEAA'
			}));
			expect(result.graphic.transactions[0]).toEqual(expect.objectContaining({
				hashAlgorithm: 'hash256',
				secret: '2F2929A09DA25C7E2412128955D0BF073B1C2AA08BB6F254DC5E7BF9C323CE9A',
				proof: 'AEAA'
			}));
		});
	});

	describe('resolveTransactionBlockSearch', () => {
		it('returns numeric block height input as the block search result', async () => {
			// Act:
			const result = await resolveTransactionBlockSearch('123456');

			// Assert:
			expect(result).toEqual({
				height: '123456'
			});
		});

		it('throws for non-numeric block height input', async () => {
			// Act + Assert:
			await expect(resolveTransactionBlockSearch('123abc')).rejects.toThrow('INVALID_TRANSACTION_BLOCK_SEARCH_FORMAT');
		});
	});

	describe('resolveTransactionRecipientSearch', () => {
		it('returns address input as the account search result', async () => {
			// Act:
			const result = await resolveTransactionRecipientSearch('TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY');

			// Assert:
			expect(result).toEqual({
				address: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY'
			});
		});

		it('converts public key input to address search result', async () => {
			// Act:
			const result = await resolveTransactionRecipientSearch('B'.repeat(64));

			// Assert:
			expect(result).toEqual({
				address: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY'
			});
		});

		it('throws for invalid recipient input format', async () => {
			// Act + Assert:
			await expect(resolveTransactionRecipientSearch('invalid-recipient'))
				.rejects.toThrow('INVALID_TRANSACTION_RECIPIENT_SEARCH_FORMAT');
		});
	});

	describe('resolveTransactionSignerSearch', () => {
		it('resolves address input to account public key search value', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				account: {
					publicKey: 'C'.repeat(64)
				}
			});

			// Act:
			const result = await resolveTransactionSignerSearch('TDLC627QB7VFVBBP5PTWAX2GRCI5T3K47ZORXQA');

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/accounts/TDLC627QB7VFVBBP5PTWAX2GRCI5T3K47ZORXQA');
			expect(result).toEqual({
				address: 'TDLC627QB7VFVBBP5PTWAX2GRCI5T3K47ZORXQA',
				value: 'C'.repeat(64)
			});
		});

		it('converts public key input to display address and signer search value', async () => {
			// Act:
			const result = await resolveTransactionSignerSearch('B'.repeat(64));

			// Assert:
			expect(result).toEqual({
				address: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				value: 'B'.repeat(64)
			});
		});

		it('throws for invalid signer input format', async () => {
			// Act + Assert:
			await expect(resolveTransactionSignerSearch('invalid-signer')).rejects.toThrow('INVALID_TRANSACTION_SIGNER_SEARCH_FORMAT');
		});

		it('throws when address account has no public key', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				account: {
					publicKey: '0'.repeat(64)
				}
			});

			// Act + Assert:
			await expect(resolveTransactionSignerSearch('TDLC627QB7VFVBBP5PTWAX2GRCI5T3K47ZORXQA'))
				.rejects.toThrow('TRANSACTION_SIGNER_PUBLIC_KEY_NOT_FOUND');
		});
	});

	describe('resolveTransactionMosaicSearch', () => {
		it('returns 16-digit hex mosaic ID input as the mosaic search result', async () => {
			// Act:
			const result = await resolveTransactionMosaicSearch('72c0212e67a08bce');

			// Assert:
			expect(result).toEqual({
				id: '72C0212E67A08BCE',
				name: '72C0212E67A08BCE'
			});
		});

		it('resolves namespace input with mosaic alias to a mosaic search result', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			const namespaceId = await namespaceIdFromName('symbol.xym');
			makeRequest.mockResolvedValueOnce({
				namespace: {
					alias: {
						type: 1,
						mosaicId: '72C0212E67A08BCE'
					}
				}
			});

			// Act:
			const result = await resolveTransactionMosaicSearch('symbol.xym');

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith(`/api/symbol-node/namespaces/${namespaceId}`);
			expect(result).toEqual({
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			});
		});

		it('normalizes pasted namespace input and attempts mosaic alias resolution', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			const namespaceId = await namespaceIdFromName('tes1.sub1');
			makeRequest.mockResolvedValueOnce({
				namespace: {
					alias: {
						type: 1,
						mosaicId: '1234567890ABCDEF'
					}
				}
			});

			// Act:
			const result = await resolveTransactionMosaicSearch('\t\ntes1.sub1');

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith(`/api/symbol-node/namespaces/${namespaceId}`);
			expect(result).toEqual({
				id: '1234567890ABCDEF',
				name: 'tes1.sub1'
			});
		});

		it('attempts namespace resolution for locally invalid namespace input', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			const error = new Error('bad request');
			error.response = { status: 400 };
			makeRequest.mockRejectedValueOnce(error);

			// Act + Assert:
			await expect(resolveTransactionMosaicSearch('abc!')).rejects.toThrow('TRANSACTION_MOSAIC_ALIAS_NOT_FOUND');
			expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/namespaces/abc!');
		});

		it('throws for empty mosaic namespace input format', async () => {
			// Act + Assert:
			await expect(resolveTransactionMosaicSearch('  ')).rejects.toThrow('INVALID_TRANSACTION_MOSAIC_SEARCH_FORMAT');
		});

		it('throws when namespace is not found', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			const error = new Error('not found');
			error.response = { status: 404 };
			makeRequest.mockRejectedValueOnce(error);

			// Act + Assert:
			await expect(resolveTransactionMosaicSearch('symbol.unknown')).rejects.toThrow('TRANSACTION_MOSAIC_ALIAS_NOT_FOUND');
		});

		it('throws when namespace alias is not a mosaic alias', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				namespace: {
					alias: {
						type: 2,
						address: 'TDLC627QB7VFVBBP5PTWAX2GRCI5T3K47ZORXQA'
					}
				}
			});

			// Act + Assert:
			await expect(resolveTransactionMosaicSearch('symbol.address')).rejects.toThrow('TRANSACTION_MOSAIC_ALIAS_NOT_FOUND');
		});
	});
});
