import symbolClient from '../../src/services/symbolClient.js';
import stateManager from '../../src/stateManager.js';
import transactionUtils from '../../src/utils/transactionUtils.js';
import { describe, jest } from '@jest/globals';

jest.spyOn(stateManager, 'update').mockResolvedValue();

describe('transactionUtils', () => {
	// Arrange:
	const mockState = {
		network: {
			networkName: 'testnet',
			url: 'http://localhost:3000',
			currencyMosaicId: 'mosaicId'
		}
	};

	const createMockTransaction = (meta, transaction, id) => ({ meta, transaction, id });

	const createMockMeta = height => ({
		height,
		hash: 'hash',
		merkleComponentHash: 'merkleComponentHash',
		index: 0,
		timestamp: '12345',
		feeMultiplier: 100
	});

	const createMockTransferTransaction = (id, height) => createMockTransaction(
		createMockMeta(height),
		{
			size: 176,
			signature: 'signature',
			signerPublicKey: 'AC2B4FD9F3D5C3565B5BBB1D723F24EFEA5DBD63FAD91863D5B338EC8A530E42',
			version: 1,
			network: 152,
			type: 16724,
			maxFee: '17600',
			deadline: '52880817608',
			recipientAddress: '981A4E4073D7DC9DC874B66A09D0AFF51EDFFC1AC5A27FBA',
			mosaics: [
				{
					id: 'mosaicId',
					amount: '1000000'
				},
				{
					id: 'mosaicId2',
					amount: '1'
				}
			]
		},
		id
	);

	const createMockVRFTransaction = (id, height) =>
		createMockTransaction(
			createMockMeta(height),
			{
				size: 161,
				signature: 'signature',
				signerPublicKey: 'D10B705D5D997B551211A666A0FB5B8CB1A1471B07C184F7448937D710B340DB',
				version: 1,
				network: 152,
				type: 16972,
				maxFee: '16100',
				deadline: '53762151416',
				linkedPublicKey: 'D10B705D5D997B551211A666A0FB5B8CB1A1471B07C184F7448937D700000000',
				linkAction: 0
			},
			id
		);

	describe('fetchAccountTransactions', () => {
		it('return account transactions without aggregate transaction', async () => {
			// Arrange:
			const mockRequestParams = {
				address: 'address',
				offsetId: ''
			};

			const mockTransactionResponse = [
				createMockTransferTransaction('1', '1552748'),
				createMockVRFTransaction('2', '1552750')
			];

			const mockFetchTransactionPageByAddress = jest.fn().mockResolvedValue(mockTransactionResponse);
			const mockFetchInnerTransactionByAggregateIds = jest.fn().mockResolvedValue();

			jest.spyOn(symbolClient, 'create').mockImplementation(() => ({
				fetchTransactionPageByAddress: mockFetchTransactionPageByAddress,
				fetchInnerTransactionByAggregateIds: mockFetchInnerTransactionByAggregateIds
			}));

			// Act:
			const result = await transactionUtils.fetchAccountTransactions({ state: mockState, requestParams: mockRequestParams });

			// Assert:
			expect(result).toStrictEqual([
				{
					id: '1',
					date: '2022-10-31 21:07:59',
					height: '1552748',
					transactionHash: 'hash',
					transactionType: 'Transfer',
					amount: '1000000',
					message: null,
					sender: 'TCZTBI7HCCFPREBWJPZIPJA3FVKC2S2NSSPJ6YQ'
				},
				{
					id: '2',
					date: '2022-10-31 21:07:59',
					height: '1552750',
					transactionHash: 'hash',
					transactionType: 'Node Key Link',
					amount: null,
					message: null,
					sender: 'TCMDJ7EW5YMATRDH2D4ZQZEAXXAZE4YEHS3JSCA'
				}
			]);
			expect(mockFetchTransactionPageByAddress).toHaveBeenCalledWith('address', '');
			expect(mockFetchInnerTransactionByAggregateIds).not.toHaveBeenCalled();
		});

		it('return account transactions with aggregate transaction', async () => {
			// Arrange:
			const mockRequestParams = {
				address: 'address',
				offsetId: ''
			};

			const mockTransactionResponse = [
				{
					meta: {
						height: '1571464',
						hash: 'hash',
						merkleComponentHash: 'merkleComponentHash',
						index: 1,
						timestamp: '53513952699',
						feeMultiplier: 100
					},
					transaction: {
						size: 264,
						signature: 'signature',
						signerPublicKey: '07BDA13095105886A9A8A623E630C90DB7B02260F835420E95B1FBEE7686E4C2',
						version: 2,
						network: 152,
						type: 16705,
						maxFee: '26400',
						deadline: '53517549052',
						transactionsHash: 'F70063AEBEA12E4CF4D7E5CB5747E060FAFC94F586FA8EBD07B12E1496EA6400',
						cosignatures: []
					},
					id: '3'
				}
			];

			const mockTransactionDetailResponse = {
				3: [
					{
						meta: {
							height: '1571464',
							aggregateHash: 'aggregateHash',
							aggregateId: '3',
							index: 0,
							timestamp: '53513952699',
							feeMultiplier: 100
						},
						transaction: {
							signerPublicKey: '07BDA13095105886A9A8A623E630C90DB7B02260F835420E95B1FBEE7686E4C2',
							version: 1,
							network: 152,
							type: 16724,
							recipientAddress: '98DA51AD51C065A958FAC4D62B9B3F58B58B6503BF53C3D5',
							mosaics: [
								{
									id: 'mosaicId',
									amount: '9213486'
								},
								{
									id: 'mosaicId2',
									amount: '1'
								}
							]
						},
						id: '3'
					},
					{
						meta: {
							height: '1571464',
							aggregateHash: 'aggregateHash',
							aggregateId: '4',
							index: 1,
							timestamp: '53513952699',
							feeMultiplier: 100
						},
						transaction: {
							signerPublicKey: '07BDA13095105886A9A8A623E630C90DB7B02260F835420E95B1FBEE7686E4C2',
							version: 1,
							network: 152,
							type: 16724,
							recipientAddress: '98DA51AD51C065A958FAC4D62B9B3F58B58B6503BF53C3D5',
							mosaics: [],
							message: 'message'
						},
						id: '4'
					}
				]
			};

			const mockFetchTransactionPageByAddress = jest.fn().mockResolvedValue(mockTransactionResponse);
			const mockFetchInnerTransactionByAggregateIds = jest.fn().mockResolvedValue(mockTransactionDetailResponse);

			jest.spyOn(symbolClient, 'create').mockImplementation(() => ({
				fetchTransactionPageByAddress: mockFetchTransactionPageByAddress,
				fetchInnerTransactionByAggregateIds: mockFetchInnerTransactionByAggregateIds
			}));

			// Act:
			const result = await transactionUtils.fetchAccountTransactions({ state: mockState, requestParams: mockRequestParams });

			// Assert:
			expect(result).toStrictEqual([
				{
					id: '3',
					date: '2024-07-12 06:06:59',
					height: '1571464',
					transactionHash: 'hash',
					transactionType: 'Aggregate Complete | Transfer',
					amount: '9213486',
					message: null,
					sender: 'TDJRSQNOOIZLAB4OQEETH2UNBQ4HC2MNQZY4P6A'
				},
				{
					id: '3',
					date: '2024-07-12 06:06:59',
					height: '1571464',
					transactionHash: 'hash',
					transactionType: 'Aggregate Complete | Transfer',
					amount: 0,
					message: 'message',
					sender: 'TDJRSQNOOIZLAB4OQEETH2UNBQ4HC2MNQZY4P6A'
				}
			]);
			expect(mockFetchTransactionPageByAddress).toHaveBeenCalledWith('address', '');
			expect(mockFetchInnerTransactionByAggregateIds).toHaveBeenCalledWith(['3']);
		});
	});

	describe('getFeeMultiplier', () => {
		it('returns fee multiplier', async () => {
			// Arrange:
			const state = {
				network: {
					identifier: 1,
					networkName: 'testnet',
					url: 'http://localhost:3000'
				},
				feeMultiplier: {
					slow: 0,
					average: 0,
					fast: 0
				}
			};

			const mockResponse = {
				slow: 100,
				average: 150,
				fast: 200
			};

			const mockFetchTransactionFeeMultiplier = jest.fn().mockResolvedValue(mockResponse);

			jest.spyOn(symbolClient, 'create').mockImplementation(() => ({
				fetchTransactionFeeMultiplier: mockFetchTransactionFeeMultiplier
			}));

			// Act:
			const result = await transactionUtils.getFeeMultiplier({ state });

			// Assert:
			expect(result).toStrictEqual(mockResponse);
			expect(stateManager.update).toHaveBeenCalledWith({
				network: state.network,
				feeMultiplier: mockResponse
			});
			expect(mockFetchTransactionFeeMultiplier).toHaveBeenCalled();
		});
	});
});
