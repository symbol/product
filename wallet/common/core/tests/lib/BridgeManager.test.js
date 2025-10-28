import { BridgeManager } from '../../src/lib/bridge/BridgeManager';
import { jest } from '@jest/globals';

const SYMBOL_BRIDGE_ADDRESS = 'TBQAAMLT4R6TPIZVWERYURELILHHMCERDWZ4FCQ';
const SYMBOL_ACCOUNT_ADDRESS = 'TBJP7DIASQUWRMNHZYW7P5XU6QCGZDBHDVK3T4Y';
const SYMBOL_TOKEN_ID = '72C0212E67A08BCE';

const ETHEREUM_BRIDGE_ADDRESS = '0x9B5b717FEC711af80050986D1306D5c8Fb9FA953';
const ETHEREUM_TOKEN_ID = '0x5E8343A455F03109B737B6D8b410e4ECCE998cdA';
const ETHEREUM_ACCOUNT_ADDRESS = '0xeCA7dadA410614B604FFcBE0378C05474b0aeD8D';

const BRIDGE_URL = 'https://bridge.example.com';

describe('BridgeManager', () => {
	const networkIdentifier = 'testnet';
	const bridgeUrlMap = { [networkIdentifier]: BRIDGE_URL };

	const createConfigResponse = () => ({
		enabled: true,
		nativeNetwork: {
			blockchain: 'symbol',
			bridgeAddress: SYMBOL_BRIDGE_ADDRESS,
			defaultNodeUrl: 'https://201-sai-dual.symboltest.net:3001',
			explorerUrl: 'https://testnet.symbol.fyi',
			network: 'testnet',
			tokenId: SYMBOL_TOKEN_ID
		},
		wrappedNetwork: {
			blockchain: 'ethereum',
			bridgeAddress: ETHEREUM_BRIDGE_ADDRESS,
			defaultNodeUrl: 'https://erigon.symboltest.net:8545',
			explorerUrl: 'http://otterscan.symboltest.net',
			network: 'testnet',
			tokenId: ETHEREUM_TOKEN_ID
		}
	});
	const createWrapRequestsResponse = () => ([
		{
			destinationAddress: ETHEREUM_ACCOUNT_ADDRESS,
			payoutConversionRate: '1000000',
			payoutNetAmount: '14999999',
			payoutStatus: 2,
			payoutTimestamp: 1757430500,
			payoutTotalFee: 1,
			payoutTransactionHash: 'C240B79CCC230438A685EB684A82DD81B58BD5A896805DC97A72D33F4812EEFF',
			payoutTransactionHeight: 49896,
			requestAmount: '15000000',
			requestTimestamp: 1757429293.906,
			requestTransactionHash: 'B2F4AD2B168F1B6EE58F1EEE41D2BEA610FC0C106B99E1A6089524E0938B3360',
			requestTransactionHeight: 2697835,
			senderAddress: SYMBOL_ACCOUNT_ADDRESS
		}
	]);
	const createUnwrapRequestsResponse = () => ([
		{
			destinationAddress: SYMBOL_ACCOUNT_ADDRESS,
			payoutConversionRate: '1000000',
			payoutNetAmount: '499982390',
			payoutStatus: 2,
			payoutTimestamp: 1756931602.309,
			payoutTotalFee: '17600',
			payoutTransactionHash: '695292A565881F2384C7FE575E421D7C25317D7C6CAB00C02EB4022F37601EE3',
			payoutTransactionHeight: 2681278,
			requestAmount: '499999990',
			requestTimestamp: 1756931504,
			requestTransactionHash: 'D2C59C2516AE16728673B0BAF82753270FBCCB261D0212976A4FD3D885418F93',
			requestTransactionHeight: 8313,
			senderAddress: ETHEREUM_ACCOUNT_ADDRESS
		}
	]);
	const createErrorResponse = () => ([
		{
			errorMessage: 'Bridge execution failed',
			requestTimestamp: 1757430500,
			requestTransactionHash: 'ERROR_REQUEST_HASH',
			requestTransactionHeight: 987654,
			senderAddress: SYMBOL_ACCOUNT_ADDRESS
		}
	]);
	const createEstimationResponse = (totalFee, netAmount) => ({
		conversionFee: '0.0069',
		diagnostics: {
			height: '2726292',
			nativeBalance: '700245000010',
			unwrappedBalance: '499999990',
			wrappedBalance: '700745000000'
		},
		grossAmount: '10000000',
		transactionFee: '0.3264',
		totalFee,
		netAmount
	});
	const createTokenInfo = id => ({
		id,
		name: id,
		divisibility: 6
	});
	const createToken = (id, amount) => ({
		id,
		name: id,
		divisibility: 6,
		amount
	});
	const createController = ({ chainName, currentAccountAddress }) => ({
		networkIdentifier,
		chainName,
		networkProperties: { chainId: 'test-chain' },
		currentAccount: { address: currentAccountAddress },
		isWalletReady: true,
		fetchAccountTransactions: jest.fn(async () => []),
		modules: {
			bridge: {
				bridgeHelper: {
					fetchTokenInfo: jest.fn(async (_props, tokenId) => createTokenInfo(tokenId))
				},
				addConfig: jest.fn()
			}
		}
	});
	const createNativeController = () => createController({
		chainName: 'symbol',
		currentAccountAddress: SYMBOL_ACCOUNT_ADDRESS
	});
	const createWrappedController = () => createController({
		chainName: 'ethereum',
		currentAccountAddress: ETHEREUM_ACCOUNT_ADDRESS
	});
	const toAbsolute = (amount, divisibility = 6) => {
		const [i, f = ''] = String(amount).split('.');
		const fPad = (f + '0'.repeat(divisibility)).slice(0, divisibility);
		const s = `${i}${fPad}`;
		return s.replace(/^0+(?=\d)/, '') || '0';
	};
	const createBridgeSearchUrl = (mode, group, address, { pageSize, pageNumber }) => {
		const count = pageSize ?? 0;
		const offset = ((pageNumber ?? 1) - 1) * (pageSize ?? 0);
		return `${BRIDGE_URL}/${mode}/${group}/${address}?count=${count}&offset=${offset}`;
	};

	let makeRequest;
	let nativeWalletController;
	let wrappedWalletController;
	let manager;

	beforeEach(() => {
		makeRequest = jest.fn();
		nativeWalletController = createNativeController();
		wrappedWalletController = createWrappedController();
		manager = new BridgeManager({
			nativeWalletController,
			wrappedWalletController,
			bridgeUrls: bridgeUrlMap,
			makeRequest
		});
	});

	describe('isEnabled', () => {
		it('is false before load, true after config enabled', async () => {
			// Arrange:
			const expectedBefore = false;
			const expectedAfter = true;
			makeRequest.mockResolvedValueOnce(createConfigResponse());

			// Act:
			const before = manager.isEnabled;
			await manager.load();
			const after = manager.isEnabled;

			// Assert:
			expect(before).toBe(expectedBefore);
			expect(after).toBe(expectedAfter);
		});

		it('is false after load when server config disabled', async () => {
			// Arrange:
			makeRequest.mockResolvedValueOnce({ ...createConfigResponse(), enabled: false });

			// Act:
			await manager.load();

			// Assert:
			expect(manager.isEnabled).toBe(false);
		});
	});

	describe('isReady', () => {
		it('is false before load', () => {
			// Act & Assert:
			expect(manager.isReady).toBe(false);
		});

		it('is true after load when controllers are ready and networks match', async () => {
			// Arrange:
			makeRequest.mockResolvedValueOnce(createConfigResponse());

			// Act:
			await manager.load();

			// Assert:
			expect(manager.isReady).toBe(true);
		});

		it('becomes false if one controller is not ready', async () => {
			// Arrange:
			makeRequest.mockResolvedValueOnce(createConfigResponse());
			await manager.load();
			nativeWalletController.isWalletReady = false;

			// Act & Assert:
			expect(manager.isReady).toBe(false);
		});

		it('becomes false if wrapped controller network identifiers mismatch', async () => {
			// Arrange:
			makeRequest.mockResolvedValueOnce(createConfigResponse());
			await manager.load();
			wrappedWalletController.networkIdentifier = 'othernet';

			// Act & Assert:
			expect(manager.isReady).toBe(false);
		});

		it('becomes false if native controller network identifiers mismatch', async () => {
			// Arrange:
			makeRequest.mockResolvedValueOnce(createConfigResponse());
			await manager.load();
			nativeWalletController.networkIdentifier = 'othernet';

			// Act & Assert:
			expect(manager.isReady).toBe(false);
		});
	});

	describe('getWalletController', () => {
		it('returns respective controllers by chain name and null for unknown', () => {
			// Arrange:
			const expectedNative = nativeWalletController;
			const expectedWrapped = wrappedWalletController;

			// Act:
			const nativeResult = manager.getWalletController('symbol');
			const wrappedResult = manager.getWalletController('ethereum');
			const nullResult = manager.getWalletController('unknown');

			// Assert:
			expect(nativeResult).toBe(expectedNative);
			expect(wrappedResult).toBe(expectedWrapped);
			expect(nullResult).toBe(null);
		});
	});

	describe('load', () => {
		it('loads config, resolves tokens, and registers bridge configs in controllers', async () => {
			// Arrange:
			const configResponse = createConfigResponse();
			const expectedUrl = `${BRIDGE_URL}/`;
			const expectedNativeConfig = {
				blockchain: configResponse.nativeNetwork.blockchain,
				bridgeAddress: configResponse.nativeNetwork.bridgeAddress,
				defaultNodeUrl: configResponse.nativeNetwork.defaultNodeUrl,
				explorerUrl: configResponse.nativeNetwork.explorerUrl,
				network: configResponse.nativeNetwork.network,
				tokenInfo: createTokenInfo(configResponse.nativeNetwork.tokenId)
			};
			const expectedWrappedConfig = {
				blockchain: configResponse.wrappedNetwork.blockchain,
				bridgeAddress: configResponse.wrappedNetwork.bridgeAddress,
				defaultNodeUrl: configResponse.wrappedNetwork.defaultNodeUrl,
				explorerUrl: configResponse.wrappedNetwork.explorerUrl,
				network: configResponse.wrappedNetwork.network,
				tokenInfo: createTokenInfo(configResponse.wrappedNetwork.tokenId)
			};
			makeRequest.mockResolvedValueOnce(createConfigResponse());

			// Act:
			await manager.load();

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
			expect(nativeWalletController.modules.bridge.bridgeHelper.fetchTokenInfo)
				.toHaveBeenCalledWith(nativeWalletController.networkProperties, configResponse.nativeNetwork.tokenId);
			expect(wrappedWalletController.modules.bridge.bridgeHelper.fetchTokenInfo)
				.toHaveBeenCalledWith(wrappedWalletController.networkProperties, configResponse.wrappedNetwork.tokenId);
			expect(nativeWalletController.modules.bridge.addConfig)
				.toHaveBeenCalledWith(expectedNativeConfig);
			expect(wrappedWalletController.modules.bridge.addConfig)
				.toHaveBeenCalledWith(expectedWrappedConfig);
		});

		it('throws if network identifiers do not match', async () => {
			// Arrange:
			const badWrapped = { ...createWrappedController(), networkIdentifier: 'othernet' };
			manager = new BridgeManager({
				nativeWalletController,
				wrappedWalletController: badWrapped,
				bridgeUrls: bridgeUrlMap,
				makeRequest
			});

			// Act & Assert:
			await expect(manager.load())
				.rejects.toThrow('Failed to load bridge config. Wallet controller network identifier mismatch.');
		});

		it('throws if chain names do not match config', async () => {
			// Arrange:
			const configResponse = createConfigResponse();
			makeRequest.mockResolvedValueOnce({
				...configResponse,
				nativeNetwork: {
					...configResponse.nativeNetwork,
					blockchain: 'other'
				}
			});

			// Act & Assert:
			await expect(manager.load())
				.rejects.toThrow('Failed to load bridge config. Bridge networks do not match wallet controller chains.');
		});
	});

	describe('fetchRequests', () => {
		const runFetchRequestsTest = async (config, expected) => {
			// Arrange:
			const {
				mode,
				searchCriteria,
				isConfigLoaded,
				isCurrentAccountSelected,
				dtoResponse
			} = config;
			manager = new BridgeManager({
				nativeWalletController,
				wrappedWalletController,
				bridgeUrls: bridgeUrlMap,
				makeRequest
			});
			if (!isCurrentAccountSelected)
				nativeWalletController.currentAccount = null;
			if (isConfigLoaded) {
				makeRequest.mockResolvedValueOnce(createConfigResponse());
				await manager.load();
			}
			if (dtoResponse)
				makeRequest.mockResolvedValueOnce(dtoResponse);

			// Act:
			let result;
			let error;
			try {
				result = await manager.fetchRequests(mode, searchCriteria);
			} catch (e) {
				error = e;
			}

			// Assert:
			if (expected.errorMessage) {
				expect(error).toBeTruthy();
				expect(error.message).toBe(expected.errorMessage);
			} else {
				const address = mode === 'wrap'
					? nativeWalletController.currentAccount.address
					: wrappedWalletController.currentAccount.address;
				const expectedUrl = createBridgeSearchUrl(mode, 'requests', address, searchCriteria);
				expect(makeRequest).toHaveBeenLastCalledWith(expectedUrl);
				expect(result).toStrictEqual(expected.expectedResult);
			}
		};

		it('throws if no current account', async () => {
			// Arrange:
			const mode = 'wrap';
			const searchCriteria = { pageSize: 5, pageNumber: 1 };
			const config = {
				mode,
				searchCriteria,
				isConfigLoaded: true,
				isCurrentAccountSelected: false
			};
			const expected = { errorMessage: 'Failed to fetch bridge requests. No current account selected' };

			// Act & Assert:
			await runFetchRequestsTest(config, expected);
		});

		it('throws if no config', async () => {
			// Arrange:
			const mode = 'wrap';
			const searchCriteria = { pageSize: 5, pageNumber: 1 };
			const config = { 
				mode, 
				searchCriteria, 
				isConfigLoaded: false,
				isCurrentAccountSelected: true
			};
			const expected = { errorMessage: 'Failed to fetch bridge requests. No bridge config fetched' };

			// Act & Assert:
			await runFetchRequestsTest(config, expected);
		});

		it('throws on invalid mode', async () => {
			// Act & Assert:
			await expect(manager.fetchRequests('bad', { pageSize: 1, pageNumber: 1 }))
				.rejects.toThrow('Invalid bridge mode: bad');
		});

		it('fetches and maps wrap requests', async () => {
			// Arrange:
			const mode = 'wrap';
			const searchCriteria = { pageSize: 1, pageNumber: 1 };
			const expectedResult = [
				{
					type: 'wrap',
					sourceChainName: 'symbol',
					targetChainName: 'ethereum',
					sourceTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
					targetTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
					payoutStatus: 2,
					payoutConversionRate: '1',
					payoutTotalFee: '0.000001',
					requestTransaction: {
						signerAddress: SYMBOL_ACCOUNT_ADDRESS,
						hash: 'B2F4AD2B168F1B6EE58F1EEE41D2BEA610FC0C106B99E1A6089524E0938B3360',
						height: 2697835,
						timestamp: 1757429293906,
						token: createToken(SYMBOL_TOKEN_ID, '15')
					},
					payoutTransaction: {
						recipientAddress: ETHEREUM_ACCOUNT_ADDRESS,
						hash: 'C240B79CCC230438A685EB684A82DD81B58BD5A896805DC97A72D33F4812EEFF',
						height: 49896,
						timestamp: 1757430500000,
						token: createToken(ETHEREUM_TOKEN_ID, '14.999999')
					}
				}
			];
			const config = {
				mode,
				searchCriteria,
				isConfigLoaded: true,
				isCurrentAccountSelected: true,
				dtoResponse: createWrapRequestsResponse()
			};
			const expected = { expectedResult };

			// Act & Assert:
			await runFetchRequestsTest(config, expected);
		});

		it('fetches and maps unwrap requests', async () => {
			// Arrange:
			const mode = 'unwrap';
			const searchCriteria = { pageSize: 1, pageNumber: 1 };
			const expectedResult = [
				{
					type: 'unwrap',
					sourceChainName: 'ethereum',
					targetChainName: 'symbol',
					sourceTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
					targetTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
					payoutStatus: 2,
					payoutConversionRate: '1',
					payoutTotalFee: '0.0176',
					requestTransaction: {
						signerAddress: ETHEREUM_ACCOUNT_ADDRESS,
						hash: 'D2C59C2516AE16728673B0BAF82753270FBCCB261D0212976A4FD3D885418F93',
						height: 8313,
						timestamp: 1756931504000,
						token: createToken(ETHEREUM_TOKEN_ID, '499.99999')
					},
					payoutTransaction: {
						recipientAddress: SYMBOL_ACCOUNT_ADDRESS,
						hash: '695292A565881F2384C7FE575E421D7C25317D7C6CAB00C02EB4022F37601EE3',
						height: 2681278,
						timestamp: 1756931602309,
						token: createToken(SYMBOL_TOKEN_ID, '499.98239')
					}
				}
			];
			const config = {
				mode,
				searchCriteria,
				isConfigLoaded: true,
				isCurrentAccountSelected: true,
				dtoResponse: createUnwrapRequestsResponse()
			};
			const expected = { expectedResult };

			// Act & Assert:
			await runFetchRequestsTest(config, expected);
		});

		it('maps request with missing payout fields (no payout yet)', async () => {
			// Arrange:
			const mode = 'wrap';
			const searchCriteria = { pageSize: 1, pageNumber: 1 };
			const dtoResponse = [{
				requestTransactionHash: 'REQ_HASH',
				requestTransactionHeight: 10,
				requestTimestamp: 12345,
				requestAmount: '1000000',
				senderAddress: SYMBOL_ACCOUNT_ADDRESS
			}];
			const nativeToken = createTokenInfo(SYMBOL_TOKEN_ID);
			const wrappedToken = createTokenInfo(ETHEREUM_TOKEN_ID);
			const expectedResult = [{
				type: 'wrap',
				sourceChainName: 'symbol',
				targetChainName: 'ethereum',
				sourceTokenInfo: nativeToken,
				targetTokenInfo: wrappedToken,
				payoutStatus: undefined,
				payoutConversionRate: null,
				payoutTotalFee: null,
				requestTransaction: {
					signerAddress: SYMBOL_ACCOUNT_ADDRESS,
					hash: 'REQ_HASH',
					height: 10,
					timestamp: 12345000,
					token: createToken(SYMBOL_TOKEN_ID, '1')
				},
				payoutTransaction: null
			}];
			const config = {
				mode,
				searchCriteria,
				isConfigLoaded: true,
				isCurrentAccountSelected: true,
				dtoResponse
			};

			// Act & Assert:
			await runFetchRequestsTest(
				config,
				{ expectedResult }
			);
		});
	});

	describe('fetchErrors', () => {
		const runFetchErrorsTest = async (config, expected) => {
			// Arrange:
			const {
				mode,
				searchCriteria,
				isConfigLoaded,
				isCurrentAccountSelected,
				dtoResponse
			} = config;
			manager = new BridgeManager({
				nativeWalletController,
				wrappedWalletController,
				bridgeUrls: bridgeUrlMap,
				makeRequest
			});

			if (!isCurrentAccountSelected)
				nativeWalletController.currentAccount = null;

			if (isConfigLoaded) {
				makeRequest.mockResolvedValueOnce(createConfigResponse());
				await manager.load();
			}
			if (dtoResponse)
				makeRequest.mockResolvedValueOnce(dtoResponse);

			// Act:
			let result;
			let error;
			try {
				result = await manager.fetchErrors(mode, searchCriteria);
			} catch (e) {
				error = e;
			}

			// Assert:
			if (expected.errorMessage) {
				expect(error).toBeTruthy();
				expect(error.message).toBe(expected.errorMessage);
			} else {
				const address = mode === 'wrap'
					? nativeWalletController.currentAccount.address
					: wrappedWalletController.currentAccount.address;
				const expectedUrl = createBridgeSearchUrl(mode, 'errors', address, searchCriteria);
				expect(makeRequest).toHaveBeenLastCalledWith(expectedUrl);
				expect(result).toStrictEqual(expected.expectedResult);
			}
		};

		it('throws if no current account', async () => {
			// Arrange:
			const mode = 'wrap';
			const searchCriteria = { pageSize: 1, pageNumber: 1 };
			const config = {
				mode,
				searchCriteria,
				isConfigLoaded: false,
				isCurrentAccountSelected: false
			};
			const expected = { errorMessage: 'Failed to fetch errors. No current account selected' };

			// Act & Assert:
			await runFetchErrorsTest(config, expected);
		});

		it('throws if no config', async () => {
			// Arrange:
			const mode = 'wrap';
			const searchCriteria = { pageSize: 1, pageNumber: 1 };
			const config = { 
				mode, 
				searchCriteria, 
				isConfigLoaded: false, 
				isCurrentAccountSelected: true
			};
			const expected = { errorMessage: 'Failed to fetch errors. No bridge config fetched' };

			// Act & Assert:
			await runFetchErrorsTest(config, expected);
		});

		it('throws on invalid mode', async () => {
			// Act & Assert:
			await expect(manager.fetchErrors('bad', { pageSize: 1, pageNumber: 1 }))
				.rejects.toThrow('Invalid bridge mode: bad');
		});

		it('fetches and maps wrap errors', async () => {
			// Arrange:
			const mode = 'wrap';
			const searchCriteria = { pageSize: 1, pageNumber: 1 };
			const expectedResult = [
				{
					type: 'wrap',
					requestStatus: 'error',
					sourceChainName: 'symbol',
					targetChainName: 'ethereum',
					sourceTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
					targetTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
					errorMessage: 'Bridge execution failed',
					requestTransaction: {
						signerAddress: SYMBOL_ACCOUNT_ADDRESS,
						hash: 'ERROR_REQUEST_HASH',
						height: 987654,
						timestamp: 1757430500000
					}
				}
			];
			const config = {
				mode,
				searchCriteria,
				isConfigLoaded: true,
				isCurrentAccountSelected: true,
				dtoResponse: createErrorResponse()
			};
			const expected = { expectedResult };

			// Act & Assert:
			await runFetchErrorsTest(config, expected);
		});

		it('fetches and maps unwrap errors', async () => {
			// Arrange:
			const dto = [{
				errorMessage: 'Oops',
				requestTimestamp: 111,
				requestTransactionHash: 'ERR_UNWRAP',
				requestTransactionHeight: 22,
				senderAddress: ETHEREUM_ACCOUNT_ADDRESS
			}];
			const expectedResult = [{
				type: 'unwrap',
				requestStatus: 'error',
				sourceChainName: 'ethereum',
				targetChainName: 'symbol',
				sourceTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
				targetTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
				errorMessage: 'Oops',
				requestTransaction: {
					signerAddress: ETHEREUM_ACCOUNT_ADDRESS,
					hash: 'ERR_UNWRAP',
					height: 22,
					timestamp: 111000
				}
			}];
			const config = {
				mode: 'unwrap',
				searchCriteria: { pageSize: 1, pageNumber: 1 },
				isConfigLoaded: true,
				isCurrentAccountSelected: true,
				dtoResponse: dto
			};

			// Act & Assert:
			await runFetchErrorsTest(
				config,
				{ expectedResult }
			);
		});
	});

	describe('fetchSentRequests', () => {
		const runFetchSentRequestsTest = async (config, expected) => {
			// Arrange:
			const {
				mode,
				isConfigLoaded,
				pageSize,
				pageNumber,
				transactions
			} = config;

			if (isConfigLoaded) {
				makeRequest.mockResolvedValueOnce(createConfigResponse());
				await manager.load();
			}

			const sourceController = mode === 'wrap' ? nativeWalletController : wrappedWalletController;
			sourceController.fetchAccountTransactions.mockResolvedValueOnce(transactions);

			// Act:
			const result = await manager.fetchSentRequests(mode, { pageSize, pageNumber });

			// Assert:
			expect(sourceController.fetchAccountTransactions).toHaveBeenLastCalledWith({
				to: mode === 'wrap'
					? manager.config.nativeNetwork.bridgeAddress
					: manager.config.wrappedNetwork.bridgeAddress,
				pageSize,
				pageNumber
			});
			expect(result).toStrictEqual(expected.expectedResult);
		};

		it('fetches and maps pending wrap requests, filters by bridge address', async () => {
			// Arrange:
			makeRequest.mockResolvedValueOnce(createConfigResponse());
			await manager.load();
			const {bridgeAddress} = manager.config.nativeNetwork;
			const lowerCaseBridge = bridgeAddress.toLowerCase();
			const mode = 'wrap';
			const pageSize = 2;
			const pageNumber = 1;
			const transactions = [
				{
					senderAddress: nativeWalletController.currentAccount.address,
					recipientAddress: lowerCaseBridge,
					hash: 'PENDING_WRAP_HASH_1',
					height: 100,
					timestamp: 1000
				},
				{
					senderAddress: nativeWalletController.currentAccount.address,
					recipientAddress: 'SOME_OTHER_ADDRESS',
					hash: 'IGNORED_HASH',
					height: 200,
					timestamp: 900
				}
			];
			const expectedResult = [
				{
					type: 'wrap',
					requestStatus: 'confirmed',
					sourceChainName: 'symbol',
					targetChainName: 'ethereum',
					sourceTokenInfo: manager.config.nativeNetwork.tokenInfo,
					targetTokenInfo: manager.config.wrappedNetwork.tokenInfo,
					requestTransaction: {
						signerAddress: nativeWalletController.currentAccount.address,
						hash: 'PENDING_WRAP_HASH_1',
						height: 100,
						timestamp: 1000
					}
				}
			];
			const config = { mode, isConfigLoaded: false, pageSize, pageNumber, transactions };
			const expected = { expectedResult };

			// Act & Assert:
			await runFetchSentRequestsTest(config, expected);
		});

		it('fetches and maps pending unwrap requests, filters by bridge address', async () => {
			// Arrange:
			makeRequest.mockResolvedValueOnce(createConfigResponse());
			await manager.load();
			const {bridgeAddress} = manager.config.wrappedNetwork;
			const mixedCaseBridge = bridgeAddress.toUpperCase();
			const mode = 'unwrap';
			const pageSize = 3;
			const pageNumber = 2;
			const transactions = [
				{
					senderAddress: wrappedWalletController.currentAccount.address,
					recipientAddress: mixedCaseBridge,
					hash: 'PENDING_UNWRAP_HASH_1',
					height: 300,
					timestamp: 2000
				},
				{
					senderAddress: wrappedWalletController.currentAccount.address,
					recipientAddress: '0xnotbridge',
					hash: 'IGNORED_HASH_2',
					height: 301,
					timestamp: 1999
				}
			];
			const expectedResult = [
				{
					type: 'unwrap',
					requestStatus: 'confirmed',
					sourceChainName: 'ethereum',
					targetChainName: 'symbol',
					sourceTokenInfo: manager.config.wrappedNetwork.tokenInfo,
					targetTokenInfo: manager.config.nativeNetwork.tokenInfo,
					requestTransaction: {
						signerAddress: wrappedWalletController.currentAccount.address,
						hash: 'PENDING_UNWRAP_HASH_1',
						height: 300,
						timestamp: 2000
					}
				}
			];
			const config = { mode, isConfigLoaded: false, pageSize, pageNumber, transactions };
			const expected = { expectedResult };

			// Act & Assert:
			await runFetchSentRequestsTest(config, expected);
		});

		it('throws if called without loaded config', async () => {
			// Act & Assert:
			await expect(manager.fetchSentRequests('wrap', { pageSize: 1, pageNumber: 1 }))
				.rejects.toThrow();
		});

		it('throws on invalid mode', async () => {
			// Arrange:
			makeRequest.mockResolvedValueOnce(createConfigResponse());
			await manager.load();

			// Act & Assert:
			await expect(manager.fetchSentRequests('bad', { pageSize: 1, pageNumber: 1 }))
				.rejects.toThrow('Invalid bridge mode: bad');
		});
	});

	describe('fetchRecentHistory', () => {
		it('merges, de-duplicates by request hash, sorts desc by timestamp, and slices by count', async () => {
			// Arrange:
			const count = 3;
			const wrapRequest = {
				type: 'wrap',
				sourceChainName: 'symbol',
				targetChainName: 'ethereum',
				sourceTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
				targetTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
				payoutStatus: 1,
				payoutConversionRate: '1',
				payoutTotalFee: '0.000001',
				requestTransaction: {
					signerAddress: SYMBOL_ACCOUNT_ADDRESS,
					hash: 'HASH1',
					height: 1,
					timestamp: 2000,
					token: createToken(SYMBOL_TOKEN_ID, '1')
				},
				payoutTransaction: null
			};
			const unwrapRequest = {
				type: 'unwrap',
				sourceChainName: 'ethereum',
				targetChainName: 'symbol',
				sourceTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
				targetTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
				payoutStatus: 2,
				payoutConversionRate: '1',
				payoutTotalFee: '0.0176',
				requestTransaction: {
					signerAddress: ETHEREUM_ACCOUNT_ADDRESS,
					hash: 'HASH2',
					height: 2,
					timestamp: 3000,
					token: createToken(ETHEREUM_TOKEN_ID, '2')
				},
				payoutTransaction: null
			};
			const wrapErrorDuplicateOfHash1 = {
				type: 'wrap',
				requestStatus: 'error',
				sourceChainName: 'symbol',
				targetChainName: 'ethereum',
				sourceTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
				targetTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
				errorMessage: 'error',
				requestTransaction: {
					signerAddress: SYMBOL_ACCOUNT_ADDRESS,
					hash: 'hash1',
					height: 0,
					timestamp: 2500
				}
			};
			const wrapPending = {
				type: 'wrap',
				requestStatus: 'confirmed',
				sourceChainName: 'symbol',
				targetChainName: 'ethereum',
				sourceTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
				targetTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
				requestTransaction: {
					signerAddress: SYMBOL_ACCOUNT_ADDRESS,
					hash: 'HASH3',
					height: 3,
					timestamp: 1000
				}
			};
			const unwrapPendingWith0xHash = {
				type: 'unwrap',
				requestStatus: 'confirmed',
				sourceChainName: 'ethereum',
				targetChainName: 'symbol',
				sourceTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
				targetTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
				requestTransaction: {
					signerAddress: ETHEREUM_ACCOUNT_ADDRESS,
					hash: '0xHASH4',
					height: 4,
					timestamp: 4000
				}
			};
			const wrapRequestsSpy = jest.spyOn(manager, 'fetchRequests').mockImplementation(async mode => {
				return mode === 'wrap' ? [wrapRequest] : [unwrapRequest];
			});
			const wrapErrorsSpy = jest.spyOn(manager, 'fetchErrors').mockImplementation(async mode => {
				return mode === 'wrap' ? [wrapErrorDuplicateOfHash1] : [];
			});
			const wrapPendingSpy = jest.spyOn(manager, 'fetchSentRequests').mockImplementation(async mode => {
				return mode === 'wrap' ? [wrapPending] : [unwrapPendingWith0xHash];
			});
			const expectedResult = [
				unwrapPendingWith0xHash,
				unwrapRequest,
				wrapRequest
			];

			// Act:
			const result = await manager.fetchRecentHistory(count);

			// Assert:
			expect(wrapRequestsSpy).toHaveBeenCalledTimes(2);
			expect(wrapErrorsSpy).toHaveBeenCalledTimes(2);
			expect(wrapPendingSpy).toHaveBeenCalledTimes(2);
			expect(result).toStrictEqual(expectedResult);
		});
	});

	describe('estimateRequest', () => {
		const runEstimateRequestTest = async (config, expected) => {
			// Arrange:
			const { mode, amount, estimationDto, error } = config;
			makeRequest.mockResolvedValueOnce(createConfigResponse());
			await manager.load();

			if (error) 
				makeRequest.mockRejectedValueOnce(error);
			else 
				makeRequest.mockResolvedValueOnce(estimationDto);
            

			// Act:
			let result;
			let thrown;
			try {
				result = await manager.estimateRequest(mode, amount);
			} catch (e) {
				thrown = e;
			}

			// Assert:
			if (expected.errorMessage) {
				expect(thrown).toBeTruthy();
				expect(thrown.message).toBe(expected.errorMessage);
			} else {
				const url = `${BRIDGE_URL}/${mode}/prepare`;
				const recipientAddress = mode === 'wrap'
					? wrappedWalletController.currentAccount.address
					: nativeWalletController.currentAccount.address;
				const absoluteAmount = toAbsolute(amount, 6);
				const requestOptions = {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						amount: absoluteAmount,
						recipientAddress
					})
				};
				if (!error) 
					expect(makeRequest).toHaveBeenLastCalledWith(url, requestOptions);
                
				expect(result).toStrictEqual(expected.expectedResult);
			}
		};

		it('estimates wrap request and maps result', async () => {
			// Arrange:
			const mode = 'wrap';
			const amount = '15';
			const estimationDto = createEstimationResponse('1', '14999999');
			const expectedResult = {
				bridgeFee: '0.000001',
				receiveAmount: '14.999999',
				error: null
			};
			const config = { mode, amount, estimationDto };
			const expected = { expectedResult };

			// Act & Assert:
			await runEstimateRequestTest(config, expected);
		});

		it('estimates unwrap request and maps result', async () => {
			// Arrange:
			const mode = 'unwrap';
			const amount = '499.99999';
			const estimationDto = createEstimationResponse('17600', '499982390');
			const expectedResult = {
				bridgeFee: '0.0176',
				receiveAmount: '499.98239',
				error: null
			};
			const config = { mode, amount, estimationDto };
			const expected = { expectedResult };

			// Act & Assert:
			await runEstimateRequestTest(config, expected);
		});

		it('returns isAmountHigh error when bridge estimation reverts with specific message', async () => {
			// Arrange:
			const mode = 'wrap';
			const amount = '1';
			const error = new Error('eth_estimateGas RPC call failed: execution reverted: ERC20: transfer amount exceeds balance');
			const expectedResult = { error: { isAmountHigh: true } };
			const config = { mode, amount, error };
			const expected = { expectedResult };

			// Act & Assert:
			await runEstimateRequestTest(config, expected);
		});

		it('sets isAmountLow when net amount negative', async () => {
			// Arrange:
			const mode = 'wrap';
			const amount = '0.0001';
			const estimationDto = createEstimationResponse('100', '-1');
			const expectedResult = {
				bridgeFee: '0.0001',
				receiveAmount: '0',
				error: { isAmountLow: true }
			};
            
			// Act & Assert:
			await runEstimateRequestTest({ mode, amount, estimationDto }, { expectedResult });
		});

		it('throws if no recipient account selected', async () => {
			// Arrange:
			const mode = 'wrap';
			wrappedWalletController.currentAccount = null;
			const amount = '10';
			makeRequest.mockResolvedValueOnce(createConfigResponse());
			await manager.load();
			const expectedErrorMessage = 'Failed to estimate bridge request. No recipient account selected';

			// Act & Assert:
			await expect(manager.estimateRequest(mode, amount))
				.rejects.toThrow(expectedErrorMessage);
		});

		it('throws on invalid mode', async () => {
			// Arrange:
			makeRequest.mockResolvedValueOnce(createConfigResponse());
			await manager.load();
			
			// Act & Assert:
			await expect(manager.estimateRequest('bad', '1'))
				.rejects.toThrow('Invalid bridge mode: bad');
		});
	});
});
