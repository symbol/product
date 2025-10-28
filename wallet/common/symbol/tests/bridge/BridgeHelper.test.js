import { BridgeHelper } from '../../src/bridge/BridgeHelper';
import { MessageType, TransactionType } from '../../src/constants';
import { encodePlainMessage } from '../../src/utils';
import { expect, jest } from '@jest/globals';

const SYMBOL_BRIDGE_ADDRESS = 'TBQAAMLT4R6TPIZVWERYURELILHHMCERDWZ4FCQ';
const SYMBOL_ACCOUNT_ADDRESS = 'TBJP7DIASQUWRMNHZYW7P5XU6QCGZDBHDVK3T4Y';
const SYMBOL_TOKEN_ID = '72C0212E67A08BCE';

const ETHEREUM_ACCOUNT_ADDRESS = '0xeCA7dadA410614B604FFcBE0378C05474b0aeD8D';

const createNetworkProperties = () => ({
	nodeUrl: 'https://example.node',
	epochAdjustment: 1615853185
});

const createPublicAccount = () => ({
	address: SYMBOL_ACCOUNT_ADDRESS,
	publicKey: '9E0D1CBB0A1E0E5D2F5E6DCCF5B9AFAAE3C8F1B3D7C9A0B2C4D6E8F0A1B2C3D4'
});

const createToken = () => ({
	id: '0x6C04FBAA',
	amount: '123456789'
});

describe('BridgeHelper', () => {
	let bridgeHelper;
	const mockMosaicApi = {
		fetchMosaicInfo: jest.fn()
	};

	beforeEach(() => {
		jest.clearAllMocks();
		bridgeHelper = new BridgeHelper({
			mosaicApi: mockMosaicApi
		});
	});

	describe('createTransaction', () => {
		const runCreateTransactionTest = async config => {
			// Arrange:
			const {
				currentAccount,
				recipientAddress,
				bridgeAddress,
				token,
				fee
			} = config;
			const expectedMessage = {
				text: recipientAddress,
				payload: encodePlainMessage(recipientAddress).substring(2),
				type: MessageType.PlainText
			};
			const expectedResult = {
				type: TransactionType.TRANSFER,
				signerPublicKey: currentAccount.publicKey,
				signerAddress: currentAccount.address,
				recipientAddress: bridgeAddress,
				mosaics: [token],
				message: expectedMessage,
				fee
			};

			// Act:
			const result = bridgeHelper.createTransaction(config);

			// Assert:
			expect(result.type).toBe(expectedResult.type);
			expect(result.signerPublicKey).toBe(expectedResult.signerPublicKey);
			expect(result.signerAddress).toBe(expectedResult.signerAddress);
			expect(result.recipientAddress).toBe(expectedResult.recipientAddress);
			expect(result.mosaics).toStrictEqual(expectedResult.mosaics);
			expect(result.message).toStrictEqual(expectedResult.message);
			expect(result.fee).toStrictEqual(expectedResult.fee);
			expect(typeof result.deadline.adjusted).toBe('number');
		};

		it('creates a transfer transaction with a fee', async () => {
			// Arrange:
			const networkProperties = createNetworkProperties();
			const currentAccount = createPublicAccount();
			const token = createToken();
			const options = {
				networkProperties,
				currentAccount,
				recipientAddress: ETHEREUM_ACCOUNT_ADDRESS,
				bridgeAddress: SYMBOL_BRIDGE_ADDRESS,
				token,
				fee: {
					amount: '0.012'
				}
			};

			// Act & Assert:
			await runCreateTransactionTest(options);
		});

		it('creates a transfer transaction without a fee', async () => {
			// Arrange:
			const networkProperties = createNetworkProperties();
			const currentAccount = createPublicAccount();
			const token = createToken();
			const options = {
				networkProperties,
				currentAccount,
				recipientAddress: ETHEREUM_ACCOUNT_ADDRESS,
				bridgeAddress: SYMBOL_BRIDGE_ADDRESS,
				token
			};

			// Act & Assert:
			await runCreateTransactionTest(options);
		});
	});

	describe('fetchTokenInfo', () => {
		const runFetchTokenInfoTest = async (config, expected) => {
			// Arrange:
			const { networkProperties, mosaicId, mosaicInfoResponse } = config;
			const { expectedResult } = expected;
			mockMosaicApi.fetchMosaicInfo.mockResolvedValueOnce(mosaicInfoResponse);

			// Act:
			const result = await bridgeHelper.fetchTokenInfo(networkProperties, mosaicId);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
			expect(mockMosaicApi.fetchMosaicInfo).toHaveBeenCalledWith(networkProperties, mosaicId);
		};

		it('fetches token info and uses the first alias name if present', async () => {
			// Arrange:
			const networkProperties = createNetworkProperties();
			const mosaicId = SYMBOL_TOKEN_ID;
			const mosaicInfoResponse = {
				id: mosaicId,
				names: ['MYTOKEN', 'MYTOKEN.ALIAS'],
				divisibility: 6
			};
			const expectedResult = {
				id: mosaicId,
				name: 'MYTOKEN',
				divisibility: 6
			};

			// Act & Assert:
			await runFetchTokenInfoTest(
				{ networkProperties, mosaicId, mosaicInfoResponse },
				{ expectedResult }
			);
		});

		it('fetches token info and falls back to id when no alias names', async () => {
			// Arrange:
			const networkProperties = createNetworkProperties();
			const mosaicId = SYMBOL_TOKEN_ID;
			const mosaicInfoResponse = {
				id: mosaicId,
				divisibility: 0
			};
			const expectedResult = {
				id: mosaicId,
				name: mosaicId,
				divisibility: 0
			};

			// Act & Assert:
			await runFetchTokenInfoTest(
				{ networkProperties, mosaicId, mosaicInfoResponse },
				{ expectedResult }
			);
		});
	});
});
