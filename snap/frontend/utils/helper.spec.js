import helper from './helper';
import webSocketClient from './webSocketClient';
import testHelper from '../components/testHelper';
import QRCode from 'qrcode';

describe('helper', () => {
	const dispatch = {
		setLoadingStatus: jest.fn(),
		setNetwork: jest.fn(),
		setSelectedAccount: jest.fn(),
		setAccounts: jest.fn(),
		setCurrency: jest.fn(),
		setMosaicInfo: jest.fn(),
		setTransactions: jest.fn(),
		setWebsocket: jest.fn()
	};

	const symbolSnap = {
		initialSnap: jest.fn(),
		createAccount: jest.fn(),
		importAccount: jest.fn(),
		getCurrency: jest.fn(),
		fetchAccountMosaics: jest.fn(),
		getMosaicInfo: jest.fn(),
		getAccounts: jest.fn(),
		fetchAccountTransactions: jest.fn(),
		signTransferTransaction: jest.fn()
	};

	describe('setupSnap', () => {
		let mockWebSocketOpen;

		beforeEach(() => {
			jest.clearAllMocks();

			mockWebSocketOpen = jest.fn();

			jest.spyOn(webSocketClient, 'create').mockImplementation(() => {
				return {
					open: mockWebSocketOpen
				};
			});

		});

		const mockSnapState = {
			network: {
				identifier: 152,
				networkName: 'testnet',
				url: 'http://localhost:3000'
			},
			accounts: {},
			mosaicInfo: {}
		};

		const assertSetupSnap = (mockSnapState, networkName, symbol) => {
			// Assert:
			expect(dispatch.setLoadingStatus).toHaveBeenNthCalledWith(1, {
				isLoading: true,
				message: 'Initializing Snap...'
			});
			expect(dispatch.setLoadingStatus).toHaveBeenNthCalledWith(2, {
				isLoading: false,
				message: ''
			});
			expect(symbolSnap.initialSnap).toHaveBeenCalledWith(networkName, symbol);
			expect(dispatch.setNetwork).toHaveBeenCalledWith(mockSnapState.network);
			expect(dispatch.setCurrency).toHaveBeenCalledWith(mockSnapState.currency);
			expect(dispatch.setMosaicInfo).toHaveBeenCalledWith({});
			expect(dispatch.setWebsocket).toHaveBeenCalled();
			expect(webSocketClient.create).toHaveBeenCalledWith('http://localhost:3000');
			expect(mockWebSocketOpen).toHaveBeenCalled();
		};

		it('initializes snap and sets network and selected account and fetch first account mosaic if accounts exist', async () => {
			// Arrange:
			const networkName = 'testnet';
			const symbol = 'usd';

			mockSnapState.accounts = {
				'0x1': {
					id: '0x1',
					address: 'address',
					label: 'Primary Account',
					networkName: 'testnet'
				},
				'0x2': {
					id: '0x2',
					address: 'address',
					label: 'Primary Account',
					networkName: 'testnet'
				}
			};

			symbolSnap.initialSnap.mockResolvedValue(mockSnapState);
			symbolSnap.fetchAccountMosaics.mockResolvedValue({
				[mockSnapState.accounts['0x1'].id]: mockSnapState.accounts['0x1']
			});
			symbolSnap.getMosaicInfo.mockResolvedValue({});
			symbolSnap.getAccounts.mockResolvedValue(mockSnapState.accounts);

			// Act:
			await helper.setupSnap(dispatch, symbolSnap, networkName, symbol);

			// Assert:
			assertSetupSnap(mockSnapState, networkName, symbol);
			expect(symbolSnap.createAccount).not.toHaveBeenCalled();
			expect(dispatch.setSelectedAccount).toHaveBeenCalledWith(Object.values(mockSnapState.accounts)[0]);
			expect(dispatch.setAccounts).toHaveBeenCalledWith(mockSnapState.accounts);
		});

		it('initializes snap and creates account when no accounts are found', async () => {
			// Arrange:
			const networkName = 'testnet';
			const symbol = 'usd';
			mockSnapState.accounts = {};

			const mockAccount = {
				id: '0x1',
				name: 'Wallet 1'
			};

			symbolSnap.initialSnap.mockResolvedValue(mockSnapState);
			symbolSnap.createAccount.mockResolvedValue(mockAccount);
			symbolSnap.getAccounts.mockResolvedValue({
				[mockAccount.id]: mockAccount
			});
			symbolSnap.getMosaicInfo.mockResolvedValue({});

			// Act:
			await helper.setupSnap(dispatch, symbolSnap, networkName, symbol);

			// Assert:
			assertSetupSnap(mockSnapState, networkName, symbol);
			expect(symbolSnap.createAccount).toHaveBeenCalledWith('Wallet 1');
			expect(dispatch.setSelectedAccount).toHaveBeenCalledWith(mockAccount);
			expect(dispatch.setAccounts).toHaveBeenCalledWith({
				[mockAccount.id]: mockAccount
			});
		});
	});

	describe('createNewAccount', () => {
		it('should create new account and updates account state', async () => {
			// Arrange:
			const accounts = {};

			const walletName = 'new Wallet';
			const newAccount = Object.values(testHelper.generateAccountsState(1))[0];

			const mosaicInfo = {
				'mosaicId 0': {
					divisibility: 6,
					networkName: 'testnet'
				}
			};

			symbolSnap.createAccount.mockResolvedValue(newAccount);
			symbolSnap.getMosaicInfo.mockResolvedValue(mosaicInfo);

			// Act:
			await helper.createNewAccount(dispatch, symbolSnap, accounts, walletName);

			// Assert:
			expect(symbolSnap.createAccount).toHaveBeenCalledWith(walletName);
			expect(symbolSnap.getMosaicInfo).toHaveBeenCalled();
			expect(dispatch.setAccounts).toHaveBeenCalledWith({ ...accounts, [newAccount.id]: newAccount });
			expect(dispatch.setSelectedAccount).toHaveBeenCalledWith(newAccount);
			expect(dispatch.setMosaicInfo).toHaveBeenCalledWith(mosaicInfo);
		});
	});

	describe('importAccount', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		const assertImportAccount = async (mockImportAccount, expectedResult) => {
			// Arrange:
			const accounts = {};

			const accountName = 'import wallet';
			const privateKey = '1F53BA3DA42800D092A0C331A20A41ACCE81D2DD6F710106953ADA277C502010';

			const mosaicInfo = {
				'mosaicId 0': {
					divisibility: 6,
					networkName: 'testnet'
				}
			};

			symbolSnap.importAccount.mockResolvedValue(mockImportAccount);
			symbolSnap.getMosaicInfo.mockResolvedValue(mosaicInfo);

			// Act:
			await helper.importAccount(dispatch, symbolSnap, accounts, accountName, privateKey);

			// Assert:
			expect(symbolSnap.importAccount).toHaveBeenCalledWith(accountName, privateKey);

			if (expectedResult) {
				expect(symbolSnap.getMosaicInfo).toHaveBeenCalled();
				expect(dispatch.setAccounts).toHaveBeenCalledWith({ ...accounts, [mockImportAccount.id]: mockImportAccount });
				expect(dispatch.setSelectedAccount).toHaveBeenCalledWith(mockImportAccount);
				expect(dispatch.setMosaicInfo).toHaveBeenCalledWith(mosaicInfo);
			} else {
				expect(dispatch.setAccounts).not.toHaveBeenCalled();
				expect(dispatch.setSelectedAccount).not.toHaveBeenCalled();
				expect(dispatch.setMosaicInfo).not.toHaveBeenCalled();
			}
		};

		it('should import account and updates account state', async () => {
			// Arrange:
			const importAccount = Object.values(testHelper.generateAccountsState(1))[0];

			await assertImportAccount(importAccount, true);
		});

		it('should not import account if user does not approve the import from metamask confirmation', async () => {
			await assertImportAccount(false, false);
		});
	});

	describe('generateAccountQRBase64', () => {
		// Arrange:
		const label = 'Primary Account';
		const publicKey = 'publicKey';
		const networkIdentifier = 152;
		const networkGenerationHashSeed = 'testnet seed';

		it('should generate account QR base64', async () => {
			// Arrange:
			// eslint-disable-next-line max-len
			const expectedQRBase64 = 'data:image/png;base64,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';

			// Act:
			const qr = await helper.generateAccountQRBase64(label, publicKey, networkIdentifier, networkGenerationHashSeed);

			// Assert:
			expect(qr).toBe(expectedQRBase64);
		});

		it('should throw error when fail to generate QR', async () => {
			// Arrange:
			const error = new Error('Fail to generate QR');

			jest.spyOn(QRCode, 'toDataURL').mockImplementation();

			QRCode.toDataURL.mockImplementation((content, callback) => {
				callback(error, null);
			});

			// Act + Assert:
			await expect(helper.generateAccountQRBase64(
				label,
				publicKey,
				networkIdentifier,
				networkGenerationHashSeed
			)).rejects.toThrow('Fail to generate QR');
		});
	});

	describe('getCurrency', () => {
		it('returns currency', async () => {
			// Arrange:
			const mockCurrency = {
				symbol: 'usd',
				price: 1.00
			};

			symbolSnap.getCurrency.mockResolvedValue(mockCurrency);

			// Act:
			await helper.getCurrency(dispatch, symbolSnap, mockCurrency.symbol);

			// Assert:
			expect(symbolSnap.getCurrency).toHaveBeenCalledWith(mockCurrency.symbol);
			expect(dispatch.setCurrency).toHaveBeenCalledWith(mockCurrency);
		});
	});

	describe('updateAccountAndMosaicInfoState', () => {
		it('fetch accounts and mosaic info and updates state', async () => {
			// Arrange:
			const mockAccounts = testHelper.generateAccountsState(2);
			const mockMosaicInfo = {
				'mosaicId 0': {
					divisibility: 6,
					networkName: 'testnet'
				}
			};

			symbolSnap.getAccounts.mockResolvedValue(mockAccounts);
			symbolSnap.getMosaicInfo.mockResolvedValue(mockMosaicInfo);

			// Act:
			await helper.updateAccountAndMosaicInfoState(dispatch, symbolSnap);

			// Assert:
			expect(symbolSnap.getAccounts).toHaveBeenCalled();
			expect(symbolSnap.fetchAccountMosaics).toHaveBeenCalledWith(['accountId 0', 'accountId 1']);
			expect(symbolSnap.getMosaicInfo).toHaveBeenCalled();
			expect(symbolSnap.getAccounts).toHaveBeenNthCalledWith(2);
			expect(dispatch.setMosaicInfo).toHaveBeenCalledWith(mockMosaicInfo);
			expect(dispatch.setAccounts).toHaveBeenCalledWith(mockAccounts);
		});
	});

	describe('updateTransactions', () => {
		it('reset transaction state and fetch transactions and updates state', async () => {
			// Arrange:
			const mockTransactions = [
				{
					id: '1',
					amount: 10,
					sender: 'address'
				},
				{
					id: '2',
					amount: 10,
					sender: 'address'
				}
			];

			const mockUnconfirmedTransactions = [
				{
					id: '3',
					amount: 10,
					sender: 'address'
				}
			];

			const address = 'address';

			symbolSnap.fetchAccountTransactions.mockResolvedValueOnce(mockUnconfirmedTransactions);
			symbolSnap.fetchAccountTransactions.mockResolvedValueOnce(mockTransactions);

			// Act:
			await helper.updateTransactions(dispatch, symbolSnap, address);

			// Assert:
			expect(dispatch.setTransactions).toHaveBeenNthCalledWith(1, []);
			expect(dispatch.setTransactions).toHaveBeenNthCalledWith(2, [
				...mockUnconfirmedTransactions,
				...mockTransactions
			]);
			expect(symbolSnap.fetchAccountTransactions).toHaveBeenNthCalledWith(1, address, '', 'unconfirmed');
			expect(symbolSnap.fetchAccountTransactions).toHaveBeenNthCalledWith(2, address, '', 'confirmed');
		});
	});

	describe('signTransferTransaction', () => {
		it('update loading status and sign transfer transaction', async () => {
			// Arrange:
			const mockTransferTransactionParams = {
				accountId: 'account id',
				recipient: 'Recipient Address',
				mosaics: [],
				message: 'this is a message',
				feeMultiplierType: 'slow'
			};

			symbolSnap.signTransferTransaction.mockResolvedValue('transactionHash');

			// Act:
			const transactionHash = await helper.signTransferTransaction(dispatch, symbolSnap, mockTransferTransactionParams);

			// Assert:
			expect(symbolSnap.signTransferTransaction).toHaveBeenCalledWith(mockTransferTransactionParams);
			expect(dispatch.setLoadingStatus).toHaveBeenNthCalledWith(1, {
				isLoading: true,
				message: 'Sending...'
			});
			expect(dispatch.setLoadingStatus).toHaveBeenNthCalledWith(2, {
				isLoading: false,
				message: ''
			});
			expect(transactionHash).toBe('transactionHash');
		});
	});

	describe('updateAccountMosaics', () => {
		it('fetch account mosaics and mosaic info and updates state', async () => {
			// Arrange:
			const accountId = 'account1';
			const mockAccountMosaics = {
				'account1': {
					id: 'account1',
					addressIndex: 1,
					type: 'metamask',
					networkName: 'network',
					label: 'label',
					address: 'address',
					publicKey: 'publicKey'
				}
			};

			const mockMosaicInfo = {
				'mosaicId': {
					divisibility: 6,
					networkName: 'testnet'
				}
			};

			symbolSnap.fetchAccountMosaics.mockResolvedValue(mockAccountMosaics);
			symbolSnap.getMosaicInfo.mockResolvedValue(mockMosaicInfo);

			// Act:
			await helper.updateAccountMosaics(dispatch, symbolSnap, accountId);

			// Assert:
			expect(symbolSnap.fetchAccountMosaics).toHaveBeenCalledWith([accountId]);
			expect(symbolSnap.getMosaicInfo).toHaveBeenCalled();
			expect(dispatch.setMosaicInfo).toHaveBeenCalledWith(mockMosaicInfo);
			expect(dispatch.setSelectedAccount).toHaveBeenCalledWith(mockAccountMosaics[accountId]);
		});
	});

	describe('updateUnconfirmedTransactions', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		// Arrange:
		const address = 'address';
		const transactions = [
			{
				id: '1',
				amount: 10,
				sender: 'address'
			},
			{
				id: '2',
				amount: 10,
				sender: 'address'
			}
		];

		it('fetch unconfirmed transactions and append it to the top transaction state', async () => {
			// Arrange:
			const mockUnconfirmedTransactions = [
				{
					id: '3',
					amount: 10,
					sender: 'address'
				}
			];

			symbolSnap.fetchAccountTransactions.mockResolvedValue(mockUnconfirmedTransactions);

			// Act:
			await helper.updateUnconfirmedTransactions(dispatch, symbolSnap, address, transactions);

			// Assert:
			expect(symbolSnap.fetchAccountTransactions).toHaveBeenCalledWith(address, '', 'unconfirmed');
			expect(dispatch.setTransactions).toHaveBeenCalledWith([
				...mockUnconfirmedTransactions,
				...transactions
			]);
		});

		it('skip update transaction state if no unconfirmed transactions', async () => {
			// Arrange:
			symbolSnap.fetchAccountTransactions.mockResolvedValue([]);

			// Act:
			await helper.updateUnconfirmedTransactions(dispatch, symbolSnap, address, transactions);

			// Assert:
			expect(symbolSnap.fetchAccountTransactions).toHaveBeenCalledWith(address, '', 'unconfirmed');
			expect(dispatch.setTransactions).not.toHaveBeenCalled();
		});
	});
});
