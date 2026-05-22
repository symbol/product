import config from '@/config';
import * as utils from '@/utils/server';
import {
	fetchTransactionPage,
	resolveTransactionBlockSearch,
	resolveTransactionMosaicSearch,
	resolveTransactionRecipientSearch,
	resolveTransactionSignerSearch
} from '@/variants/symbol/api/transactions';
import { namespaceIdFromName } from '@/variants/symbol/api/namespaces';

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
		config.SYMBOL_NATIVE_MOSAIC_ALIAS_IDS = ['AABBCCDDEEFF0011'];
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

		it('labels only transferred XYM mosaics as XYM', async () => {
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
									id: '0xaabbccddeeff0011',
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
					id: '0xaabbccddeeff0011',
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
			expect(makeRequest).toHaveBeenCalledWith(
				'/api/symbol-node/transactions/confirmed?pageNumber=2&pageSize=50&order=desc&orderBy=id&recipientAddress=TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY'
			);
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
			expect(makeRequest).toHaveBeenCalledWith(
				`/api/symbol-node/transactions/confirmed?pageNumber=2&pageSize=50&order=desc&orderBy=id&signerPublicKey=${'B'.repeat(64)}`
			);
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
			expect(makeRequest).toHaveBeenCalledWith(
				'/api/symbol-node/transactions/confirmed?pageNumber=2&pageSize=50&order=desc&orderBy=id&height=123456'
			);
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
				mosaic: '72C0212E67A08BCE'
			});

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith(
				'/api/symbol-node/transactions/confirmed?pageNumber=2&pageSize=50&order=desc&orderBy=id&transferMosaicId=72C0212E67A08BCE'
			);
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
			await expect(resolveTransactionRecipientSearch('invalid-recipient')).rejects.toThrow('INVALID_TRANSACTION_RECIPIENT_SEARCH_FORMAT');
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
