import { TransferModule } from '../../src/modules/TransferModule';
import { currentAccount as currentAccountFixture } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';

const createFee = () => ({
	key: 'value'
});

const createEthereumToken = () => ({
	id: 'ETH',
	name: 'ETH',
	amount: '1.0',
	divisibility: 18
});

const createERC20Token = () => ({
	id: '0xERC20',
	name: 'ERC20',
	amount: '1.0',
	divisibility: 6
});

describe('TransferModule', () => {
	let transferModule;
	let root;
	let api;

	const currentAccount = { ...currentAccountFixture };
	const recipientAddress = '0xRecipientAddress';

	beforeEach(() => {
		root = {
			currentAccount,
			networkProperties: { networkIdentifier: 'erigon_local' }
		};
		api = {
			transaction: {
				fetchTransactionNonce: jest.fn(async () => 10)
			}
		};
		transferModule = new TransferModule();
		transferModule.init({ root, api });

		jest.clearAllMocks();
	});

	it('has correct static name', () => {
		// Assert:
		expect(TransferModule.name).toBe('transfer');
	});

	describe('createTransaction()', () => {
		const runCreateTransactionTest = async (tokens, expectedResult) => {
			// Arrange:
			const options = {
				recipientAddress,
				tokens,
				fee: createFee()
			};

			// Act:
			const result = await transferModule.createTransaction(options);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
			expect(api.transaction.fetchTransactionNonce).toHaveBeenCalledWith(
				root.networkProperties,
				currentAccount.address
			);
		};
		
		it('creates a ETH transfer transaction', async () => {
			// Arrange:
			const tokens = [createEthereumToken()];
			const expectedResult = {
				type: 1,
				recipientAddress,
				signerAddress: currentAccount.address,
				signerPublicKey: currentAccount.publicKey,
				fee: createFee(),
				tokens,
				nonce: 10
			};

			// Act & Assert:
			await runCreateTransactionTest(tokens, expectedResult);
		});

		it('creates a ERC20 transfer transaction', async () => {
			// Arrange:
			const tokens = [createERC20Token()];

			const expectedResult = {
				type: 2,
				recipientAddress,
				signerAddress: currentAccount.address,
				signerPublicKey: currentAccount.publicKey,
				fee: createFee(),
				tokens,
				nonce: 10
			};

			// Act & Assert:
			await runCreateTransactionTest(tokens, expectedResult);
		});
	});
});
