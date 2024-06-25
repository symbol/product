import helper from './helper';
import testHelper from '../components/testHelper';

describe('helper', () => {
	const dispatch = {
		setLoadingStatus: jest.fn(),
		setNetwork: jest.fn(),
		setSelectedAccount: jest.fn(),
		setAccounts: jest.fn()
	};

	const symbolSnap = {
		initialSnap: jest.fn(),
		createAccount: jest.fn(),
		importAccount: jest.fn()
	};

	describe('setupSnap', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		const mockSnapState = {
			network: {
				identifier: 152,
				networkName: 'testnet',
				url: 'http://localhost:3000'
			},
			accounts: {}
		};

		const assertSetupSnap = (mockSnapState, networkName) => {
			// Assert:
			expect(dispatch.setLoadingStatus).toHaveBeenNthCalledWith(1, {
				isLoading: true,
				message: 'Initializing Snap...'
			});
			expect(dispatch.setLoadingStatus).toHaveBeenNthCalledWith(2, {
				isLoading: false,
				message: ''
			});
			expect(symbolSnap.initialSnap).toHaveBeenCalledWith(networkName);
			expect(dispatch.setNetwork).toHaveBeenCalledWith(mockSnapState.network);
		};

		it('initializes snap and sets network and selected account if accounts exist', async () => {
			// Arrange:
			const networkName = 'testnet';

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

			// Act:
			await helper.setupSnap(dispatch, symbolSnap, networkName);

			// Assert:
			assertSetupSnap(mockSnapState, networkName);
			expect(symbolSnap.createAccount).not.toHaveBeenCalled();
			expect(dispatch.setSelectedAccount).toHaveBeenCalledWith(Object.values(mockSnapState.accounts)[0]);
			expect(dispatch.setAccounts).toHaveBeenCalledWith(mockSnapState.accounts);
		});

		it('initializes snap and creates account when no accounts are found', async () => {
			// Arrange:
			const networkName = 'testnet';
			mockSnapState.accounts = {};
			const mockAccount = {
				id: '0x1',
				name: 'Wallet 1'
			};

			symbolSnap.initialSnap.mockResolvedValue(mockSnapState);
			symbolSnap.createAccount.mockResolvedValue(mockAccount);

			// Act:
			await helper.setupSnap(dispatch, symbolSnap, networkName);

			// Assert:
			assertSetupSnap(mockSnapState, networkName);
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

			symbolSnap.createAccount.mockResolvedValue(newAccount);

			// Act:
			await helper.createNewAccount(dispatch, symbolSnap, accounts, walletName);

			// Assert:
			expect(symbolSnap.createAccount).toHaveBeenCalledWith(walletName);
			expect(dispatch.setAccounts).toHaveBeenCalledWith({ ...accounts, [newAccount.id]: newAccount });
			expect(dispatch.setSelectedAccount).toHaveBeenCalledWith(newAccount);
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

			symbolSnap.importAccount.mockResolvedValue(mockImportAccount);

			// Act:
			await helper.importAccount(dispatch, symbolSnap, accounts, accountName, privateKey);

			// Assert:
			expect(symbolSnap.importAccount).toHaveBeenCalledWith(accountName, privateKey);

			if (expectedResult) {
				expect(dispatch.setAccounts).toHaveBeenCalledWith({ ...accounts, [mockImportAccount.id]: mockImportAccount });
				expect(dispatch.setSelectedAccount).toHaveBeenCalledWith(mockImportAccount);
			} else {
				expect(dispatch.setAccounts).not.toHaveBeenCalled();
				expect(dispatch.setSelectedAccount).not.toHaveBeenCalled();
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
});
