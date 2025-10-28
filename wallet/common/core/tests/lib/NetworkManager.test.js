import { NetworkConnectionStatus } from '../../src/constants';
import { ControllerError } from '../../src/error/ControllerError';
import { NetworkManager } from '../../src/lib/controller/NetworkManager';
import { networkIdentifiers } from '../fixtures/wallet';
import { jest } from '@jest/globals';

describe('NetworkManager', () => {
	const testNetworkIdentifier = networkIdentifiers[0];
	const anotherTestNetworkIdentifier = networkIdentifiers[1];
	const pollingInterval = 5000;
	const nodeUrl1 = 'http://node1.testnet.com:3000';
	const nodeUrl2 = 'http://node2.testnet.com:3000';

	let manager;
	let mockApi;
	let mockLogger;
	let mockOnConnectionStatusChange;
	let mockOnPropertiesUpdate;
	let mockOnChainEvent;
	let createDefaultNetworkProperties;

	beforeEach(() => {
		jest.useFakeTimers();

		mockLogger = {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn()
		};

		mockApi = {
			network: {
				fetchNodeList: jest.fn(),
				fetchNetworkInfo: jest.fn(),
				pingNode: jest.fn()
			},
			listener: {
				createListener: jest.fn().mockReturnValue({
					open: jest.fn().mockResolvedValue(undefined),
					close: jest.fn(),
					listenAddedTransactions: jest.fn(),
					listenRemovedTransactions: jest.fn(),
					listenTransactionError: jest.fn()
				})
			}
		};

		mockOnConnectionStatusChange = jest.fn();
		mockOnPropertiesUpdate = jest.fn();
		mockOnChainEvent = jest.fn();
		createDefaultNetworkProperties = jest.fn(networkIdentifier => ({
			networkIdentifier,
			nodeUrl: null
		}));

		manager = new NetworkManager({
			logger: mockLogger,
			networkIdentifiers,
			createDefaultNetworkProperties,
			api: mockApi,
			pollingInterval,
			onConnectionStatusChange: mockOnConnectionStatusChange,
			onPropertiesUpdate: mockOnPropertiesUpdate,
			onChainEvent: mockOnChainEvent
		});
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('constructor and initial state', () => {
		it('initializes with default state', () => {
			// Assert:
			expect(manager.networkConnectionStatus).toBe(NetworkConnectionStatus.INITIAL);
			expect(manager.networkProperties).toEqual({ networkIdentifier: testNetworkIdentifier, nodeUrl: null });
			expect(manager.nodeUrls[testNetworkIdentifier]).toEqual([]);
		});
	});

	describe('init', () => {
		it('initializes the manager with provided values', () => {
			// Arrange:
			const initialProperties = { networkIdentifier: testNetworkIdentifier, nodeUrl: nodeUrl1 };

			// Act:
			manager.init(testNetworkIdentifier, initialProperties, nodeUrl1);

			// Assert:
			expect(manager.networkProperties).toEqual(initialProperties);
			expect(manager.networkConnectionStatus).toBe(NetworkConnectionStatus.INITIAL);
			expect(mockOnConnectionStatusChange).toHaveBeenCalledWith(NetworkConnectionStatus.INITIAL);
		});
	});

	describe('selectNetwork', () => {
		it('selects a new network and resets state', async () => {
			// Act:
			await manager.selectNetwork(anotherTestNetworkIdentifier, nodeUrl2);

			// Assert:
			expect(manager.networkProperties.networkIdentifier).toBe(anotherTestNetworkIdentifier);
			expect(manager.networkConnectionStatus).toBe(NetworkConnectionStatus.INITIAL);
			expect(mockOnPropertiesUpdate).toHaveBeenCalled();
			expect(mockOnConnectionStatusChange).toHaveBeenCalledWith(NetworkConnectionStatus.INITIAL);
		});
	});

	describe('fetchNodeList', () => {
		it('fetches and updates the node list for the current network', async () => {
			// Arrange:
			const nodeList = [nodeUrl1, nodeUrl2];
			mockApi.network.fetchNodeList.mockResolvedValue(nodeList);
			manager.init(testNetworkIdentifier);

			// Act:
			const result = await manager.fetchNodeList();

			// Assert:
			expect(mockApi.network.fetchNodeList).toHaveBeenCalledWith(testNetworkIdentifier);
			expect(result).toEqual(nodeList);
			expect(manager.nodeUrls[testNetworkIdentifier]).toEqual(nodeList);
		});
	});

	describe('fetchNetworkProperties', () => {
		it('fetches and sets network properties on success', async () => {
			// Arrange:
			const nodeUrls = [nodeUrl1, nodeUrl2];
			const networkInfo = { networkIdentifier: testNetworkIdentifier, nodeUrl: nodeUrl1 };
			const networkProperties = { ...networkInfo, nodeUrls };
			mockApi.network.fetchNetworkInfo.mockResolvedValue(networkInfo);
			mockApi.network.fetchNodeList.mockResolvedValue(nodeUrls);
			manager.init(testNetworkIdentifier);

			// Act:
			const result = await manager.fetchNetworkProperties(nodeUrl1);

			// Assert:
			expect(mockApi.network.fetchNetworkInfo).toHaveBeenCalledWith(nodeUrl1);
			expect(result).toEqual(networkProperties);
			expect(manager.networkProperties).toEqual(networkProperties);
			expect(manager.networkConnectionStatus).toBe(NetworkConnectionStatus.CONNECTED);
			expect(mockOnPropertiesUpdate).toHaveBeenCalledWith(networkProperties);
			expect(mockOnConnectionStatusChange).toHaveBeenCalledWith(NetworkConnectionStatus.CONNECTED);
		});

		it('throws an error if fetched network identifier does not match', async () => {
			// Arrange:
			const properties = { networkIdentifier: anotherTestNetworkIdentifier, nodeUrl: nodeUrl1 };
			mockApi.network.fetchNetworkInfo.mockResolvedValue(properties);
			manager.init(testNetworkIdentifier);

			// Act & Assert:
			await expect(manager.fetchNetworkProperties(nodeUrl1)).rejects.toThrow(ControllerError);
		});
	});

	describe('runConnectionJob', () => {
		beforeEach(() => {
			jest.spyOn(global, 'setTimeout');
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it('connects to a user-selected node successfully', async () => {
			// Arrange:
			const properties = { networkIdentifier: testNetworkIdentifier, nodeUrl: nodeUrl1 };
			mockApi.network.fetchNetworkInfo.mockResolvedValue(properties);
			manager.init(testNetworkIdentifier, null, nodeUrl1);

			// Act:
			await manager.runConnectionJob();

			// Assert:
			expect(manager.networkConnectionStatus).toBe(NetworkConnectionStatus.CONNECTED);
			expect(mockOnConnectionStatusChange).toHaveBeenCalledWith(NetworkConnectionStatus.CONNECTED);
			expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), pollingInterval);
		});

		it('fails to connect to a user-selected node and sets status to FAILED_CUSTOM_NODE', async () => {
			// Arrange:
			mockApi.network.fetchNetworkInfo.mockRejectedValue(new Error('Connection failed'));
			manager.init(testNetworkIdentifier, null, nodeUrl1);
			// Simulate a previous connection attempt
			manager._state.networkConnectionStatus = NetworkConnectionStatus.CONNECTING;

			// Act:
			await manager.runConnectionJob();

			// Assert:
			expect(manager.networkConnectionStatus).toBe(NetworkConnectionStatus.FAILED_CUSTOM_NODE);
			expect(mockOnConnectionStatusChange).toHaveBeenCalledWith(NetworkConnectionStatus.FAILED_CUSTOM_NODE);
			expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), pollingInterval);
		});

		it('auto-selects a node and connects successfully', async () => {
			// Arrange:
			const nodeList = [nodeUrl1, nodeUrl2];
			const networkInfo = { networkIdentifier: testNetworkIdentifier, nodeUrl: nodeUrl2 };
			const networkProperties = { ...networkInfo, nodeUrls: nodeList };
			mockApi.network.fetchNodeList.mockResolvedValue(nodeList);
			mockApi.network.pingNode.mockRejectedValueOnce(new Error('Ping failed')); // node1 fails
			mockApi.network.pingNode.mockResolvedValueOnce(undefined); // node2 succeeds
			mockApi.network.fetchNetworkInfo.mockResolvedValue(networkProperties);
			manager.init(testNetworkIdentifier);

			// Act:
			await manager.runConnectionJob();

			// Assert:
			expect(mockApi.network.pingNode).toHaveBeenCalledWith(nodeUrl1);
			expect(mockApi.network.pingNode).toHaveBeenCalledWith(nodeUrl2);
			expect(manager.networkConnectionStatus).toBe(NetworkConnectionStatus.CONNECTED);
			expect(manager.networkProperties).toEqual(networkProperties);
			expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), pollingInterval);
		});

		it('sets status to NO_INTERNET if node list fetch fails', async () => {
			// Arrange:
			mockApi.network.fetchNodeList.mockRejectedValue(new Error('No internet'));
			manager.init(testNetworkIdentifier);

			// Act:
			await manager.runConnectionJob();

			// Assert:
			expect(manager.networkConnectionStatus).toBe(NetworkConnectionStatus.NO_INTERNET);
			expect(mockOnConnectionStatusChange).toHaveBeenCalledWith(NetworkConnectionStatus.NO_INTERNET);
			expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), pollingInterval);
		});
	});

	describe('Chain Listener', () => {
		it('starts and stops the chain listener', async () => {
			// Arrange:
			const accountAddress = 'TCF3372B2Y5NFO2NXI7ZEOB625YJ63J6B5R5QYQ';
			const properties = { networkIdentifier: testNetworkIdentifier, nodeUrl: nodeUrl1 };
			manager.init(testNetworkIdentifier, properties);
			manager._state.networkConnectionStatus = NetworkConnectionStatus.CONNECTED;
			
			// Act:
			manager.setListenAddress(accountAddress);
			await manager.restartChainListener();

			// Assert:
			expect(mockApi.listener.createListener).toHaveBeenCalledWith(properties, accountAddress);
			expect(manager._state.chainListener).not.toBeNull();
			expect(manager._state.chainListener.open).toHaveBeenCalled();

			// Act:
			manager.stopChainListener();

			// Assert:
			expect(manager._state.chainListener).toBeNull();
		});

		it('stops the chain listener if not connected', async () => {
			// Arrange:
			const properties = { networkIdentifier: testNetworkIdentifier, nodeUrl: nodeUrl1 };
			manager.init(testNetworkIdentifier, properties);
			manager._state.networkConnectionStatus = NetworkConnectionStatus.CONNECTING;

			// Act:
			await manager.restartChainListener();

			// Assert:
			expect(mockApi.listener.createListener).not.toHaveBeenCalled();
			expect(manager._state.chainListener).toBeNull();
		});
	});
});
