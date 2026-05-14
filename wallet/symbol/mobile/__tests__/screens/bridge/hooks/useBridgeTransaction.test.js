import { useBridgeTransaction } from '@/app/screens/bridge/hooks/useBridgeTransaction';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { TransactionFixtureBuilder } from '__fixtures__/local/TransactionFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';
import { createWalletControllerMock } from '__tests__/mock-helpers';
import { act } from '@testing-library/react-native';
import { TransactionBundle } from 'wallet-common-core'; // eslint-disable-line import/order

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

const transactionBundle = new TransactionBundle([bridgeTransaction]);

const bridge = {
	createTransactionForStep: jest.fn().mockResolvedValue(transactionBundle)
};

const sourceWalletController = createWalletControllerMock({
	currentAccount: sourceAccount
});

const targetWalletController = createWalletControllerMock({
	currentAccount: targetAccount
});

const targetSide = {
	chainName: 'ethereum',
	networkIdentifier: NETWORK_IDENTIFIER,
	token: sourceToken,
	walletController: targetWalletController
};

// Hook Helpers

const createHookParams = overrides => ({
	bridge,
	walletController: sourceWalletController,
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
			getConfirmationPreview: 'function'
		}
	});

	describe('initialization', () => {
		it('creates transaction using initialized params and builds confirmation sections', async () => {
			// Arrange:
			const params = createHookParams();
			let createdBundle;
			let sections;

			// Act:
			const hookTester = new HookTester(useBridgeTransaction, [params]);
			await act(async () => {
				createdBundle = await hookTester.currentResult.createTransaction();
				sections = hookTester.currentResult.getConfirmationPreview(createdBundle);
			});

			// Assert:
			expect(bridge.createTransactionForStep).toHaveBeenCalledWith(0, {
				recipientAddress: targetAccount.address,
				amount: AMOUNT,
				amountOutMinimum: undefined
			});
			expect(createdBundle).toStrictEqual(transactionBundle);
			expect(sections).toStrictEqual([{
				id: 'section_0',
				title: '',
				chainName: sourceWalletController.chainName,
				networkIdentifier: sourceWalletController.networkIdentifier,
				addressBook: sourceWalletController.modules.addressBook,
				walletAccounts: sourceWalletController.accounts,
				tableData: [
					{ type: 'account', value: bridgeTransaction.signerAddress, title: 'signerAddress' },
					{ type: 'account', value: bridgeTransaction.message.text, title: 'recipientAddress' },
					{ type: 'token', value: bridgeTransaction.mosaics, title: 'tokens' },
					{ type: 'fee', value: bridgeTransaction.fee, title: 'fee' }
				]
			}]);
		});
	});
});
