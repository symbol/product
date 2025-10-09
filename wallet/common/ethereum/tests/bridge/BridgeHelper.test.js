import { BridgeHelper } from '../../src/bridge/BridgeHelper';
import { TransactionType } from '../../src/constants';
import { base32ToHex } from '../../src/utils';
import { jest } from '@jest/globals';

// Reusable test data
const networkProperties = {
	nodeUrl: 'http://localhost:8545',
	networkIdentifier: 'mainnet',
	networkCurrency: { id: 'ETH', name: 'Ethereum', divisibility: 18 }
};
const currentAccount = {
	address: '0xAbCDEF0000000000000000000000000000000000',
	publicKey: '0xPUBKEY'
};
const recipientAddress = 'TALICE2GMA34CXHD7XLJQ536NM5UNKQHTORNNT2J';
const bridgeAddress = '0x0000000000000000000000000000000000bRIDG';
const token = { id: '0xToken', name: 'USDC', divisibility: 6, amount: '100' };
const fee = { maxFee: '20000000000', gasLimit: '21000' };

const createHelper = (overrides = {}) => {
	const tokenApi = overrides.tokenApi ?? { fetchTokenInfo: jest.fn() };
	const transactionApi = overrides.transactionApi ?? { fetchTransactionNonce: jest.fn() };
	return {
		helper: new BridgeHelper({ tokenApi, transactionApi }),
		tokenApi,
		transactionApi
	};
};

describe('bridge/BridgeHelper', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('createTransaction', () => {
		it('creates ERC20 bridge transfer transaction with encoded recipient and nonce', async () => {
			// Arrange:
			const expectedNonce = 42;
			const { helper, transactionApi } = createHelper();
			transactionApi.fetchTransactionNonce.mockResolvedValue(expectedNonce);

			const expectedPayload = base32ToHex(recipientAddress);
			const expectedResult = {
				type: TransactionType.ERC_20_BRIDGE_TRANSFER,
				signerPublicKey: currentAccount.publicKey,
				signerAddress: currentAccount.address,
				recipientAddress: bridgeAddress,
				tokens: [token],
				message: {
					text: recipientAddress,
					payload: expectedPayload,
					type: 1
				},
				fee,
				nonce: expectedNonce
			};

			// Act:
			const result = await helper.createTransaction({
				currentAccount,
				networkProperties,
				recipientAddress,
				token,
				fee,
				bridgeAddress
			});

			// Assert:
			expect(transactionApi.fetchTransactionNonce)
				.toHaveBeenCalledWith(networkProperties, currentAccount.address);
			expect(result).toStrictEqual(expectedResult);
		});
	});

	describe('fetchTokenInfo', () => {
		it('returns network currency when tokenId equals network currency id', async () => {
			// Arrange:
			const tokenId = networkProperties.networkCurrency.id;
			const { helper } = createHelper();
			const expectedResult = networkProperties.networkCurrency;

			// Act:
			const result = await helper.fetchTokenInfo(networkProperties, tokenId);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		});

		it('returns network currency when tokenId is falsy', async () => {
			// Arrange:
			const tokenId = undefined;
			const { helper } = createHelper();
			const expectedResult = networkProperties.networkCurrency;

			// Act:
			const result = await helper.fetchTokenInfo(networkProperties, tokenId);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		});

		it('delegates to tokenApi when tokenId differs from network currency id', async () => {
			// Arrange:
			const tokenId = '0xAnotherToken';
			const tokenInfo = { id: tokenId, name: 'DAI', divisibility: 18 };
			const { helper, tokenApi } = createHelper();
			tokenApi.fetchTokenInfo.mockResolvedValue(tokenInfo);
			const expectedResult = tokenInfo;

			// Act:
			const result = await helper.fetchTokenInfo(networkProperties, tokenId);

			// Assert:
			expect(tokenApi.fetchTokenInfo).toHaveBeenCalledWith(networkProperties, tokenId);
			expect(result).toStrictEqual(expectedResult);
		});
	});
});
