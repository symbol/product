import { TransactionBundle } from '../../src/lib/models/TransactionBundle';
import { BridgeModule } from '../../src/lib/modules/BridgeModule';
import { expect, jest } from '@jest/globals';

describe('BridgeModule', () => {
	// Arrange:
	const networkIdentifier = 'testnet';
	const networkProperties = { chainId: 'test-chain' };
	const chainName = 'symbol';

	const makeWalletController = (overrides = {}) => ({
		currentAccount: { address: 'ADDR' },
		currentAccountInfo: {
			tokens: [
				{ id: 'XYM', name: 'XYM', divisibility: 6, amount: '123' },
				{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', divisibility: 6, amount: '25' }
			]
		},
		networkIdentifier,
		networkProperties,
		chainName,
		...overrides
	});

	const makeBridgeHelper = () => ({
		createTransaction: jest.fn(async payload => ({ ok: true, payload })),
		fetchTokenInfo: jest.fn(async (_networkProps, tokenId) => ({
			id: tokenId,
			name: tokenId,
			divisibility: 6
		}))
	});

	const createTokenInfo = id => ({
		id,
		name: id,
		divisibility: 6
	});

	const createConfig = (overrides = {}) => ({
		blockchain: chainName,
		bridgeAddress: 'TBQAAMLT4R6TPIZVWERYURELILHHMCERDWZ4FCQ',
		defaultNodeUrl: 'https://node.example.com:3001',
		explorerUrl: 'https://explorer.example.com',
		network: networkIdentifier,
		tokenInfo: createTokenInfo('72C0212E67A08BCE'),
		...overrides
	});

	let bridgeHelper;
	let walletController;
	let onStateChange;
	let moduleUnderTest;

	beforeEach(() => {
		// Arrange:
		bridgeHelper = makeBridgeHelper();
		walletController = makeWalletController();
		onStateChange = jest.fn();

		moduleUnderTest = new BridgeModule({ bridgeHelper });
		moduleUnderTest.init({ walletController, onStateChange, networkIdentifiers: [networkIdentifier] });
	});

	it('has correct static name', () => {
		// Act:
		const {name} = BridgeModule;

		// Assert:
		expect(name).toBe('bridge');
	});

	describe('configs and tokens', () => {
		it('tokens is empty when no configs are added', () => {
			// Act:
			const {tokens} = moduleUnderTest;

			// Assert:
			expect(tokens).toEqual([]);
		});

		it('addConfig adds config for current network and triggers onStateChange', () => {
			// Arrange:
			const config = createConfig();
			const bridgeId = config.bridgeAddress;

			// Act:
			moduleUnderTest.addConfig(bridgeId, config);

			// Assert:
			expect(onStateChange).toHaveBeenCalledTimes(1);
			expect(moduleUnderTest.configs[bridgeId]).toEqual(config);
		});

		it('getConfig returns config by bridgeId', () => {
			// Arrange:
			const config = createConfig();
			const bridgeId = 'BRIDGE_1';
			moduleUnderTest.addConfig(bridgeId, config);

			// Act:
			const found = moduleUnderTest.getConfig(bridgeId);

			// Assert:
			expect(found).toEqual(config);
		});

		it('removeConfig removes config and triggers onStateChange', () => {
			// Arrange:
			const config = createConfig();
			const bridgeId = 'BRIDGE_1';
			moduleUnderTest.addConfig(bridgeId, config);
			onStateChange.mockClear();

			// Act:
			moduleUnderTest.removeConfig(bridgeId);

			// Assert:
			expect(onStateChange).toHaveBeenCalledTimes(1);
			expect(moduleUnderTest.getConfig(bridgeId)).toBeNull();
		});

		it('tokens merges unique token list across configs and returns owned balances or zero', () => {
			// Arrange: two configs with same token id + a not-owned token
			const config1 = createConfig({ bridgeAddress: 'ADDR1', tokenInfo: createTokenInfo('72C0212E67A08BCE') });
			const config2 = createConfig({ bridgeAddress: 'ADDR2', tokenInfo: createTokenInfo('NOT_OWNED') });
			const config3 = createConfig({ bridgeAddress: 'ADDR3', tokenInfo: createTokenInfo('72C0212E67A08BCE') }); // duplicate token id
			moduleUnderTest.addConfig('BRIDGE1', config1);
			moduleUnderTest.addConfig('BRIDGE2', config2);
			moduleUnderTest.addConfig('BRIDGE3', config3);

			// Act:
			const {tokens} = moduleUnderTest;

			// Assert:
			expect(tokens).toEqual([
				{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', divisibility: 6, amount: '25' },
				{ id: 'NOT_OWNED', name: 'NOT_OWNED', divisibility: 6, amount: '0' }
			]);
		});

		it('tokens reads mosaics when tokens are missing', () => {
			// Arrange:
			walletController = makeWalletController({
				currentAccountInfo: {
					mosaics: [{ id: 'MOS', name: 'MOS', divisibility: 6, amount: '77' }]
				}
			});
			moduleUnderTest.init({ walletController, onStateChange, networkIdentifiers: [networkIdentifier] });
			const config = createConfig({ tokenInfo: createTokenInfo('MOS') });
			moduleUnderTest.addConfig('BRIDGE_MOS', config);

			// Act:
			const {tokens} = moduleUnderTest;

			// Assert:
			expect(tokens).toEqual([{ id: 'MOS', name: 'MOS', divisibility: 6, amount: '77' }]);
		});
	});

	describe('fetchTokenInfo', () => {
		it('delegates to bridgeHelper with networkProperties and tokenId', async () => {
			// Arrange:
			const tokenId = 'TOKEN_ID';

			// Act:
			const result = await moduleUnderTest.fetchTokenInfo(tokenId);

			// Assert:
			expect(bridgeHelper.fetchTokenInfo).toHaveBeenCalledWith(networkProperties, tokenId);
			expect(result).toEqual({
				id: tokenId,
				name: tokenId,
				divisibility: 6
			});
		});
	});

	describe('createTransaction', () => {
		const baseConfig = createConfig({ tokenInfo: createTokenInfo('72C0212E67A08BCE') });

		beforeEach(() => {
			// Arrange:
			moduleUnderTest.addConfig('BRIDGE_XYM', baseConfig);
		});

		it('throws when bridge config is not found', async () => {
			// Act & Assert:
			await expect(moduleUnderTest.createTransaction({
				recipientAddress: 'DEST',
				amount: '10',
				bridgeId: 'UNKNOWN'
			})).rejects.toThrow('Failed to create bridge transaction. Bridge config not found');
		});

		it('throws when no current account', async () => {
			// Arrange:
			const wc = makeWalletController({ currentAccount: null });
			moduleUnderTest.init({ walletController: wc, onStateChange, networkIdentifiers: [networkIdentifier] });
			moduleUnderTest.addConfig('BRIDGE_XYM', baseConfig);

			// Act & Assert:
			await expect(moduleUnderTest.createTransaction({
				recipientAddress: 'DEST',
				amount: '10',
				bridgeId: 'BRIDGE_XYM'
			})).rejects.toThrow('Failed to create bridge transaction. No current account selected');
		});

		it('creates transaction via bridgeHelper with expected payload', async () => {
			// Arrange:
			const bridgeId = 'BRIDGE_XYM';
			const config = baseConfig;
			const amount = '25';
			const fee = 0.123;
			const recipientAddress = 'DEST_ADDR';
			const expectedToken = {
				...config.tokenInfo,
				amount
			};
			const expectedOptions = {
				currentAccount: walletController.currentAccount,
				networkProperties,
				recipientAddress,
				bridgeAddress: config.bridgeAddress,
				token: expectedToken,
				fee
			};
			const expectedResult = new TransactionBundle([{
				ok: true,
				payload: expectedOptions
			}]);

			// Act:
			const result = await moduleUnderTest.createTransaction({ recipientAddress, amount, bridgeId, fee });

			// Assert:
			expect(bridgeHelper.createTransaction).toHaveBeenCalledWith(expectedOptions);
			expect(result.toJSON()).toStrictEqual(expectedResult.toJSON());
		});
	});
});
