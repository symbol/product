import { useBridgeTransaction } from '@/app/screens/bridge/hooks/useBridgeTransaction';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { TransactionFixtureBuilder } from '__fixtures__/local/TransactionFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';
import { createWalletControllerMock } from '__tests__/mock-helpers';
import { act } from '@testing-library/react-native';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const BRIDGE_ID = 'symbol-xym-ethereum-wxym';
const AMOUNT = '25';

// Fixtures

const SOURCE_ACCOUNT = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const TARGET_ACCOUNT = AccountFixtureBuilder
	.createWithAccount('ethereum', NETWORK_IDENTIFIER, 0)
	.build();

const SOURCE_TOKEN = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('200')
	.build();

const TRANSFER_TOKEN = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount(AMOUNT)
	.build();

const TRANSACTION_FEE_TOKEN = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('0.1')
	.build();

const BRIDGE_TRANSACTION = TransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.override({
		message: { text: TARGET_ACCOUNT.address },
		mosaics: [TRANSFER_TOKEN],
		fee: {
			token: TRANSACTION_FEE_TOKEN
		}
	})
	.build();

const BRIDGE_MODULE = {
	createTransaction: jest.fn().mockResolvedValue(BRIDGE_TRANSACTION)
};

const SOURCE_WALLET_CONTROLLER = createWalletControllerMock({
	currentAccount: SOURCE_ACCOUNT,
	modules: {
		bridge: BRIDGE_MODULE
	}
});

const TARGET_WALLET_CONTROLLER = createWalletControllerMock({
	currentAccount: TARGET_ACCOUNT
});

const SOURCE_SIDE = {
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: SOURCE_TOKEN,
	walletController: SOURCE_WALLET_CONTROLLER
};

const TARGET_SIDE = {
	chainName: 'ethereum',
	networkIdentifier: NETWORK_IDENTIFIER,
	token: SOURCE_TOKEN,
	walletController: TARGET_WALLET_CONTROLLER
};

// Hook Helpers

const createHookParams = overrides => ({
	bridgeId: BRIDGE_ID,
	source: SOURCE_SIDE,
	target: TARGET_SIDE,
	amount: AMOUNT,
	...overrides
});

describe('hooks/useBridgeTransaction', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	runHookContractTest(useBridgeTransaction, {
		props: [createHookParams()],
		contract: {
			createTransaction: 'function',
			getTransactionPreviewTable: 'function'
		}
	});

	describe('initialization', () => {
		it('creates transaction using initialized params and builds preview rows', async () => {
			// Arrange:
			const params = createHookParams();
			const expectedTransactionData = {
				bridgeId: BRIDGE_ID,
				recipientAddress: TARGET_ACCOUNT.address,
				amount: AMOUNT
			};
			let createdTransaction;
			let previewTable;

			// Act:
			const hookTester = new HookTester(useBridgeTransaction, [params]);
			await act(async () => {
				createdTransaction = await hookTester.currentResult.createTransaction();
				previewTable = hookTester.currentResult.getTransactionPreviewTable(createdTransaction);
			});

			// Assert:
			expect(BRIDGE_MODULE.createTransaction).toHaveBeenCalledWith(expectedTransactionData);
			expect(createdTransaction).toStrictEqual(BRIDGE_TRANSACTION);
			expect(previewTable).toStrictEqual([
				{ type: 'account', value: BRIDGE_TRANSACTION.signerAddress, title: 'signerAddress' },
				{ type: 'account', value: BRIDGE_TRANSACTION.message.text, title: 'recipientAddress' },
				{ type: 'token', value: BRIDGE_TRANSACTION.mosaics, title: 'mosaics' },
				{ type: 'fee', value: BRIDGE_TRANSACTION.fee, title: 'fee' }
			]);
		});
	});
});
