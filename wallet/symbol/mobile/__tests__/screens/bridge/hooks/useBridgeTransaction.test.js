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
const AMOUNT = '25';

// Fixtures

const sourceAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const targetAccount = AccountFixtureBuilder
	.createWithAccount('ethereum', NETWORK_IDENTIFIER, 0)
	.build();

const sourceToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('200')
	.build();

const transferToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount(AMOUNT)
	.build();

const transactionFeeToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('0.1')
	.build();

const bridgeTransaction = TransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.override({
		message: { text: targetAccount.address },
		mosaics: [transferToken],
		fee: {
			token: transactionFeeToken
		}
	})
	.build();

const bridge = {
	createTransactionForStep: jest.fn().mockResolvedValue(bridgeTransaction)
};

const sourceWalletController = createWalletControllerMock({
	currentAccount: sourceAccount
});

const targetWalletController = createWalletControllerMock({
	currentAccount: targetAccount
});

const sourceSide = {
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: sourceToken,
	walletController: sourceWalletController
};

const targetSide = {
	chainName: 'ethereum',
	networkIdentifier: NETWORK_IDENTIFIER,
	token: sourceToken,
	walletController: targetWalletController
};

// Hook Helpers

const createHookParams = overrides => ({
	bridge,
	source: sourceSide,
	target: targetSide,
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
			let createdTransaction;
			let previewTable;

			// Act:
			const hookTester = new HookTester(useBridgeTransaction, [params]);
			await act(async () => {
				createdTransaction = await hookTester.currentResult.createTransaction();
				previewTable = hookTester.currentResult.getTransactionPreviewTable(createdTransaction);
			});

			// Assert:
			expect(bridge.createTransactionForStep).toHaveBeenCalledWith(0, {
				recipientAddress: targetAccount.address,
				amount: AMOUNT,
				amountOutMinimum: undefined
			});
			expect(createdTransaction).toStrictEqual(bridgeTransaction);
			expect(previewTable).toStrictEqual([
				{ type: 'account', value: bridgeTransaction.signerAddress, title: 'signerAddress' },
				{ type: 'account', value: bridgeTransaction.message.text, title: 'recipientAddress' },
				{ type: 'token', value: bridgeTransaction.mosaics, title: 'tokens' },
				{ type: 'fee', value: bridgeTransaction.fee, title: 'fee' }
			]);
		});
	});
});
