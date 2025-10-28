import { jest } from '@jest/globals';

const actualUtils = await import('../../src/utils');

const createEthereumJrpcProviderMock = jest.fn();
const transactionToEthereumMock = jest.fn();
const transactionFromDTOMock = jest.fn();
const getUnresolvedIdsFromTransactionDTOsMock = jest.fn();

jest.unstable_mockModule('../../src/utils', async () => {
	return {
		...actualUtils,
		createEthereumJrpcProvider: createEthereumJrpcProviderMock,
		transactionToEthereum: transactionToEthereumMock,
		transactionFromDTO: transactionFromDTOMock,
		getUnresolvedIdsFromTransactionDTOs: getUnresolvedIdsFromTransactionDTOsMock
	};
});

const { TransactionService } = await import('../../src/api/TransactionService');

const networkProperties = {
	nodeUrl: 'http://localhost:8545',
	networkIdentifier: 'mainnet',
	networkCurrency: { id: 'ETH', name: 'Ethereum', divisibility: 18 }
};

const currentAccount = { address: '0xAbCDEF0000000000000000000000000000000000' };

const createService = (overrides = {}) =>
	new TransactionService({
		api: overrides.api ?? {
			block: { fetchBlockInfos: jest.fn() },
			token: { fetchTokenInfos: jest.fn() }
		},
		makeRequest: overrides.makeRequest ?? jest.fn()
	});

describe('api/TransactionService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('fetchAccountTransactions', () => {
		it('fetches and resolves transactions with provided pageSize', async () => {
			// Arrange:
			const transactionDTOs = [{ hash: '0x1' }, { hash: '0x2' }];
			const resolvedTransactions = [{ id: 'tx1' }, { id: 'tx2' }];
			const provider = {
				send: jest.fn().mockResolvedValue({ txs: transactionDTOs })
			};
			createEthereumJrpcProviderMock.mockReturnValue(provider);

			const service = createService();
			const resolveSpy = jest
				.spyOn(service, 'resolveTransactionDTOs')
				.mockResolvedValue(resolvedTransactions);

			const pageSize = 5;

			// Act:
			const result = await service.fetchAccountTransactions(networkProperties, currentAccount, { pageSize });

			// Assert:
			expect(createEthereumJrpcProviderMock).toHaveBeenCalledWith(networkProperties);
			expect(provider.send).toHaveBeenCalledWith('ots_searchTransactionsBefore', [
				currentAccount.address,
				0,
				pageSize
			]);
			expect(resolveSpy).toHaveBeenCalledWith(networkProperties, transactionDTOs, currentAccount);
			expect(result).toBe(resolvedTransactions);
		});

		it('uses default pageSize when not provided', async () => {
			// Arrange:
			const provider = { send: jest.fn().mockResolvedValue({ txs: [] }) };
			createEthereumJrpcProviderMock.mockReturnValue(provider);

			const service = createService();
			jest.spyOn(service, 'resolveTransactionDTOs').mockResolvedValue([]);

			// Act:
			await service.fetchAccountTransactions(networkProperties, currentAccount);

			// Assert:
			expect(provider.send).toHaveBeenCalledWith('ots_searchTransactionsBefore', [
				currentAccount.address,
				0,
				15
			]);
		});
	});

	describe('announceTransaction', () => {
		it('announces transaction and returns hash', async () => {
			// Arrange:
			const dto = { payload: '0xdeadbeef' };
			const provider = {
				broadcastTransaction: jest.fn().mockResolvedValue({ hash: '0xHASH' })
			};
			createEthereumJrpcProviderMock.mockReturnValue(provider);
			const service = createService();

			// Act:
			const result = await service.announceTransaction(networkProperties, dto);

			// Assert:
			expect(provider.broadcastTransaction).toHaveBeenCalledWith(dto);
			expect(result).toBe('0xHASH');
		});

		it('throws ApiError on failure', async () => {
			// Arrange:
			const dto = { payload: '0xdeadbeef' };
			const provider = {
				broadcastTransaction: jest.fn().mockRejectedValue(new Error('boom'))
			};
			createEthereumJrpcProviderMock.mockReturnValue(provider);
			const service = createService();

			// Act & Assert:
			await expect(service.announceTransaction(networkProperties, dto))
				.rejects.toThrow('Transaction announce failed: boom');
		});
	});

	describe('estimateTransactionGasLimit', () => {
		it('estimates gas and returns as string', async () => {
			// Arrange:
			const transaction = { kind: 'transfer', to: '0xabc' };
			const ethTx = { to: '0xabc', data: '0x' };
			transactionToEthereumMock.mockReturnValue(ethTx);

			const provider = {
				estimateGas: jest.fn().mockResolvedValue(123456n)
			};
			createEthereumJrpcProviderMock.mockReturnValue(provider);

			const service = createService();

			// Act:
			const result = await service.estimateTransactionGasLimit(networkProperties, transaction);

			// Assert:
			expect(transactionToEthereumMock).toHaveBeenCalledWith(transaction, {
				networkIdentifier: networkProperties.networkIdentifier
			});
			expect(provider.estimateGas).toHaveBeenCalledWith(ethTx);
			expect(result).toBe('123456');
		});

		it('throws ApiError when estimation fails', async () => {
			// Arrange:
			const transaction = { kind: 'transfer' };
			transactionToEthereumMock.mockReturnValue({});

			const provider = {
				estimateGas: jest.fn().mockRejectedValue(new Error('bad'))
			};
			createEthereumJrpcProviderMock.mockReturnValue(provider);

			const service = createService();

			// Act & Assert:
			await expect(service.estimateTransactionGasLimit(networkProperties, transaction))
				.rejects.toThrow('Gas limit estimation failed: bad');
		});
	});

	describe('fetchTransactionNonce', () => {
		it('fetches pending nonce', async () => {
			// Arrange:
			const address = '0xabc';
			const provider = {
				getTransactionCount: jest.fn().mockResolvedValue(7)
			};
			createEthereumJrpcProviderMock.mockReturnValue(provider);
			const service = createService();

			// Act:
			const result = await service.fetchTransactionNonce(networkProperties, address);

			// Assert:
			expect(provider.getTransactionCount).toHaveBeenCalledWith(address, 'pending');
			expect(result).toBe(7);
		});

		it('throws ApiError on failure', async () => {
			// Arrange:
			const address = '0xabc';
			const provider = {
				getTransactionCount: jest.fn().mockRejectedValue(new Error('oops'))
			};
			createEthereumJrpcProviderMock.mockReturnValue(provider);
			const service = createService();

			// Act & Assert:
			await expect(service.fetchTransactionNonce(networkProperties, address))
				.rejects.toThrow('Nonce fetching failed: oops');
		});
	});

	describe('resolveTransactionDTOs', () => {
		it('resolves DTOs using unresolved ids and maps via transactionFromDTO', async () => {
			// Arrange:
			const transactionDTOs = [{ id: 'a' }, { id: 'b' }];
			const unresolved = {
				blockHeights: [100, 101],
				tokenContractAddresses: ['0xToken']
			};
			getUnresolvedIdsFromTransactionDTOsMock.mockReturnValue(unresolved);

			const blocks = [{ height: 100 }, { height: 101 }];
			const tokenInfos = { '0xToken': { id: '0xToken', name: 'TKN', divisibility: 18 } };

			const api = {
				block: { fetchBlockInfos: jest.fn().mockResolvedValue(blocks) },
				token: { fetchTokenInfos: jest.fn().mockResolvedValue(tokenInfos) }
			};
			const service = createService({ api });

			const mappedA = { hash: '0xA' };
			const mappedB = { hash: '0xB' };
			transactionFromDTOMock
				.mockReturnValueOnce(mappedA)
				.mockReturnValueOnce(mappedB);

			// Act:
			const result = await service.resolveTransactionDTOs(networkProperties, transactionDTOs, currentAccount);

			// Assert:
			expect(api.block.fetchBlockInfos).toHaveBeenCalledWith(networkProperties, unresolved.blockHeights);
			expect(api.token.fetchTokenInfos).toHaveBeenCalledWith(networkProperties, unresolved.tokenContractAddresses);

			// Called for each DTO with expected config:
			const [, cfgA] = transactionFromDTOMock.mock.calls[0];
			expect(cfgA.blocks).toBe(blocks);
			expect(cfgA.tokenInfos).toBe(tokenInfos);
			expect(cfgA.currentAccount).toBe(currentAccount);
			expect(cfgA.networkProperties).toBe(networkProperties);

			const [, cfgB] = transactionFromDTOMock.mock.calls[1];
			expect(cfgB.blocks).toBe(blocks);
			expect(cfgB.tokenInfos).toBe(tokenInfos);

			expect(result).toStrictEqual([mappedA, mappedB]);
		});
	});
});
