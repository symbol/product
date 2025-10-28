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
		createTransaction: jest.fn(async payload => ({ ok: true, payload }))
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

		it('addConfig adds config and triggers onStateChange; duplicate does not', () => {
			// Arrange:
			const config = createConfig();

			// Act:
			moduleUnderTest.addConfig(config);

			// Assert:
			expect(onStateChange).toHaveBeenCalledTimes(1);
			expect(moduleUnderTest.configs.length).toBe(1);

			// Act: add the same config again
			onStateChange.mockClear();
			moduleUnderTest.addConfig({ ...config });

			// Assert:
			expect(onStateChange).not.toHaveBeenCalled();
			expect(moduleUnderTest.configs.length).toBe(1);
		});

		it('addConfig throws on network mismatch', () => {
			// Arrange:
			const bad = createConfig({ network: 'othernet' });

			// Act & Assert:
			expect(() => moduleUnderTest.addConfig(bad))
				.toThrow('Failed to add bridge config. Network mismatch');
		});

		it('addConfig throws on chain name mismatch', () => {
			// Arrange:
			const bad = createConfig({ blockchain: 'other' });

			// Act & Assert:
			expect(() => moduleUnderTest.addConfig(bad))
				.toThrow('Failed to add bridge config. Chain name mismatch');
		});

		it('getConfig returns config by bridgeAddress', () => {
			// Arrange:
			const config = createConfig();
			moduleUnderTest.addConfig(config);

			// Act:
			const found = moduleUnderTest.getConfig(config.bridgeAddress);

			// Assert:
			expect(found).toEqual(config);
		});

		it('tokens merges unique token list across configs and returns owned balances or zero', () => {
			// Arrange: two configs with same token id + a not-owned token
			const config1 = createConfig({ bridgeAddress: 'ADDR1', tokenInfo: createTokenInfo('72C0212E67A08BCE') });
			const config2 = createConfig({ bridgeAddress: 'ADDR2', tokenInfo: createTokenInfo('NOT_OWNED') });
			const config3 = createConfig({ bridgeAddress: 'ADDR3', tokenInfo: createTokenInfo('72C0212E67A08BCE') }); // duplicate token id
			moduleUnderTest.addConfig(config1);
			moduleUnderTest.addConfig(config2);
			moduleUnderTest.addConfig(config3);

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
			moduleUnderTest.addConfig(config);

			// Act:
			const {tokens} = moduleUnderTest;

			// Assert:
			expect(tokens).toEqual([{ id: 'MOS', name: 'MOS', divisibility: 6, amount: '77' }]);
		});
	});

	describe('createTransaction', () => {
		const baseConfig = createConfig({ tokenInfo: createTokenInfo('72C0212E67A08BCE') });

		it('throws when no current account', async () => {
			// Arrange:
			const wc = makeWalletController({ currentAccount: null });
			moduleUnderTest.init({ walletController: wc, onStateChange, networkIdentifiers: [networkIdentifier] });
			const token = { id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', divisibility: 6, amount: '10' };

			// Act & Assert:
			await expect(moduleUnderTest.createTransaction({
				recipientAddress: 'DEST',
				token,
				config: baseConfig
			})).rejects.toThrow('Failed to create bridge transaction. No current account selected');
		});

		it('throws on chain name mismatch', async () => {
			// Arrange:
			const badConfig = createConfig({ blockchain: 'other' });
			const token = { id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', divisibility: 6, amount: '10' };

			// Act & Assert:
			await expect(moduleUnderTest.createTransaction({
				recipientAddress: 'DEST',
				token,
				config: badConfig
			})).rejects.toThrow('Failed to create bridge transaction. Chain name mismatch');
		});

		it('throws on network mismatch', async () => {
			// Arrange:
			const badConfig = createConfig({ network: 'othernet' });
			const token = { id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', divisibility: 6, amount: '10' };

			// Act & Assert:
			await expect(moduleUnderTest.createTransaction({
				recipientAddress: 'DEST',
				token,
				config: badConfig
			})).rejects.toThrow('Failed to create bridge transaction. Network mismatch');
		});

		it('creates transaction via bridgeHelper with expected payload', async () => {
			// Arrange:
			const config = baseConfig;
			const token = {
				id: config.tokenInfo.id,
				name: config.tokenInfo.name,
				divisibility: config.tokenInfo.divisibility,
				amount: '25'
			};
			const fee = 0.123;
			const recipientAddress = 'DEST_ADDR';

			// Act:
			const result = await moduleUnderTest.createTransaction({ recipientAddress, token, config, fee });

			// Assert:
			const expectedPayload = {
				currentAccount: walletController.currentAccount,
				networkProperties,
				recipientAddress,
				bridgeAddress: config.bridgeAddress,
				token,
				fee
			};
			expect(bridgeHelper.createTransaction).toHaveBeenCalledWith(expectedPayload);
			expect(result).toEqual({ ok: true, payload: expectedPayload });
		});
	});
});
