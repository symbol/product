import { jest } from '@jest/globals';

const actualUtils = await import('../../src/utils');

// Mocks
const createEthereumJrpcProviderMock = jest.fn();

// A configurable mock for ethers' WebSocketProvider
const WebSocketProviderMock = jest.fn().mockImplementation(function (url) {
	this.url = url;
	this.listeners = {};
	this.on = jest.fn((event, handler) => {
		this.listeners[event] = this.listeners[event] || [];
		this.listeners[event].push(handler);
	});
	this.emit = (event, ...args) => {
		(this.listeners[event] || []).forEach(h => h(...args));
	};
	this.removeAllListeners = jest.fn(async () => {
		this.listeners = {};
	});
	this.destroy = jest.fn(async () => {});
});

jest.unstable_mockModule('../../src/utils', async () => {
	return {
		...actualUtils,
		createEthereumJrpcProvider: createEthereumJrpcProviderMock
	};
});

jest.unstable_mockModule('ethers', async () => {
	return {
		JsonRpcProvider: function () {},
		WebSocketProvider: WebSocketProviderMock
	};
});

const { Listener } = await import('../../src/api/Listener');
const { TransactionGroup } = await import('../../src/constants');

// Reusable test data
const networkProperties = {
	nodeUrl: 'http://localhost:8545',
	wsUrl: 'ws://localhost:8546',
	networkIdentifier: 'mainnet',
	networkCurrency: { id: 'ETH', name: 'Ethereum', divisibility: 18 }
};
const accountAddress = '0xAbCDEF0000000000000000000000000000000000';

const createListener = (overrides = {}) =>
	new Listener(
		overrides.networkProperties ?? networkProperties,
		overrides.accountAddress ?? accountAddress,
		overrides.websocketInjected
	);

describe('api/Listener', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('stores lowercased account address', () => {
			// Arrange:
			const mixedCase = '0xAbCd';

			// Act:
			const listener = createListener({ accountAddress: mixedCase });

			// Assert:
			expect(listener.accountAddress).toBe(mixedCase.toLowerCase());
		});
	});

	describe('open', () => {
		it('initializes providers and attaches error handler', async () => {
			// Arrange:
			const jrpcProvider = {};
			createEthereumJrpcProviderMock.mockReturnValue(jrpcProvider);
			const onUnsolicitedClose = jest.fn();
			const listener = createListener();

			// Act:
			await listener.open(onUnsolicitedClose);

			// Assert:
			expect(createEthereumJrpcProviderMock).toHaveBeenCalledWith(networkProperties);
			expect(WebSocketProviderMock).toHaveBeenCalledWith(networkProperties.wsUrl);
			expect(listener.jrpcProvider).toBe(jrpcProvider);
			expect(listener.wsProvider).toBeInstanceOf(WebSocketProviderMock);
			expect(listener.wsProvider.on).toHaveBeenCalledWith('error', expect.any(Function));
		});

		it('calls unsolicited close callback on ws error when not SIGINT', async () => {
			// Arrange:
			const jrpcProvider = {};
			createEthereumJrpcProviderMock.mockReturnValue(jrpcProvider);
			const onUnsolicitedClose = jest.fn();
			const listener = createListener();
			await listener.open(onUnsolicitedClose);

			// Act:
			listener.wsProvider.emit('error', new Error('socket down'));

			// Assert:
			expect(onUnsolicitedClose).toHaveBeenCalledWith({
				client: 'eth-listener',
				code: -1,
				reason: 'socket down'
			});
		});

		it('does not call unsolicited close callback when SIGINT is true', async () => {
			// Arrange:
			createEthereumJrpcProviderMock.mockReturnValue({});
			const onUnsolicitedClose = jest.fn();
			const listener = createListener();
			await listener.open(onUnsolicitedClose);
			listener.SIGINT = true;

			// Act:
			listener.wsProvider.emit('error', new Error('ignored'));

			// Assert:
			expect(onUnsolicitedClose).not.toHaveBeenCalled();
		});

		it('throws ApiError when initialization fails', async () => {
			// Arrange:
			createEthereumJrpcProviderMock.mockImplementationOnce(() => {
				throw new Error('no rpc');
			});
			const listener = createListener();

			// Act & Assert:
			await expect(listener.open()).rejects.toThrow('Failed to open Listener. no rpc');
		});
	});

	describe('close', () => {
		it('removes listeners, destroys ws and clears providers', async () => {
			// Arrange:
			createEthereumJrpcProviderMock.mockReturnValue({});
			const listener = createListener();
			await listener.open();

			// Act:
			await listener.close();

			// Assert:
			expect(listener.wsProvider).toBeNull();
			expect(listener.jrpcProvider).toBeNull();
			// removeAllListeners and destroy called
			expect(WebSocketProviderMock.mock.instances[0].removeAllListeners).toHaveBeenCalled();
			expect(WebSocketProviderMock.mock.instances[0].destroy).toHaveBeenCalled();
		});

		it('does nothing when wsProvider is not set', async () => {
			// Arrange:
			const listener = createListener();

			// Act:
			await listener.close();

			// Assert:
			expect(listener.wsProvider).toBeNull();
			expect(listener.jrpcProvider).toBeNull();
		});

		it('swallows destroy errors', async () => {
			// Arrange:
			createEthereumJrpcProviderMock.mockReturnValue({});
			const listener = createListener();
			await listener.open();
			WebSocketProviderMock.mock.instances[0].destroy.mockRejectedValue(new Error('boom'));

			// Act:
			await listener.close();

			// Assert:
			expect(listener.wsProvider).toBeNull();
			expect(listener.jrpcProvider).toBeNull();
		});
	});

	describe('listenAddedTransactions (UNCONFIRMED)', () => {
		it('invokes callback when pending tx is from the account', async () => {
			// Arrange:
			const txHash = '0xHASH';
			const provider = {
				getTransaction: jest.fn().mockResolvedValue({
					hash: txHash,
					from: accountAddress,
					to: '0xSomeone'
				})
			};
			createEthereumJrpcProviderMock.mockReturnValue(provider);
			const listener = createListener();
			await listener.open();
			const callback = jest.fn();
			listener.listenAddedTransactions(TransactionGroup.UNCONFIRMED, callback);

			// Act:
			listener.wsProvider.emit('pending', txHash);
			await Promise.resolve();

			// Assert:
			expect(provider.getTransaction).toHaveBeenCalledWith(txHash);
			expect(callback).toHaveBeenCalledWith({ hash: txHash });
		});

		it('does nothing when getTransaction returns null', async () => {
			// Arrange:
			const txHash = '0xNULL';
			const provider = { getTransaction: jest.fn().mockResolvedValue(null) };
			createEthereumJrpcProviderMock.mockReturnValue(provider);
			const listener = createListener();
			await listener.open();
			const callback = jest.fn();
			listener.listenAddedTransactions(TransactionGroup.UNCONFIRMED, callback);

			// Act:
			listener.wsProvider.emit('pending', txHash);
			await Promise.resolve();

			// Assert:
			expect(callback).not.toHaveBeenCalled();
		});

		it('invokes callback when pending tx is to the account', async () => {
			// Arrange:
			const txHash = '0xHASH2';
			const provider = {
				getTransaction: jest.fn().mockResolvedValue({
					hash: txHash,
					from: '0xOther',
					to: accountAddress
				})
			};
			createEthereumJrpcProviderMock.mockReturnValue(provider);
			const listener = createListener();
			await listener.open();
			const callback = jest.fn();
			listener.listenAddedTransactions(TransactionGroup.UNCONFIRMED, callback);

			// Act:
			listener.wsProvider.emit('pending', txHash);
			await Promise.resolve();

			// Assert:
			expect(callback).toHaveBeenCalledWith({ hash: txHash });
		});
	});

	describe('listenAddedTransactions (CONFIRMED)', () => {
		it('invokes callback for matching txs within a block', async () => {
			// Arrange:
			const blockHeight = 123;
			const txA = { hash: '0xA', from: accountAddress, to: '0xX' };
			const txB = { hash: '0xB', from: '0xY', to: accountAddress.toLowerCase() };
			const txC = { hash: '0xC', from: '0xY', to: '0xZ' };
			const provider = {
				getBlock: jest.fn().mockResolvedValue({
					prefetchedTransactions: [txA, txB, txC]
				})
			};
			createEthereumJrpcProviderMock.mockReturnValue(provider);
			const listener = createListener();
			await listener.open();
			const callback = jest.fn();
			listener.listenAddedTransactions(TransactionGroup.CONFIRMED, callback);

			// Act:
			listener.wsProvider.emit('block', blockHeight);
			await Promise.resolve();

			// Assert:
			expect(provider.getBlock).toHaveBeenCalledWith(blockHeight, true);
			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenNthCalledWith(1, { hash: '0xA' });
			expect(callback).toHaveBeenNthCalledWith(2, { hash: '0xB' });
		});

		it('does nothing when block or prefetchedTransactions missing', async () => {
			// Arrange:
			const provider = { getBlock: jest.fn().mockResolvedValue(null) };
			createEthereumJrpcProviderMock.mockReturnValue(provider);
			const listener = createListener();
			await listener.open();
			const callback = jest.fn();
			listener.listenAddedTransactions(TransactionGroup.CONFIRMED, callback);

			// Act:
			listener.wsProvider.emit('block', 999);
			await Promise.resolve();

			// Assert:
			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe('listenNewBlock', () => {
		it('invokes callback with block height', async () => {
			// Arrange:
			createEthereumJrpcProviderMock.mockReturnValue({});
			const listener = createListener();
			await listener.open();
			const callback = jest.fn();
			listener.listenNewBlock(callback);

			// Act:
			listener.wsProvider.emit('block', 456);
			await Promise.resolve();

			// Assert:
			expect(callback).toHaveBeenCalledWith({ height: 456 });
		});
	});
});
