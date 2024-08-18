import dispatchUtils from './dispatchUtils';

describe('dispatchUtils', () => {
	let dispatchState = jest.fn();
	let dispatch;

	beforeEach(() => {
		jest.clearAllMocks();
		dispatch = dispatchUtils(dispatchState);
	});
	describe('setIsSnapInstalled', () => {
		const assertIsSnapInstalled = isInstalled => {
			// Act:
			dispatch.setIsSnapInstalled(isInstalled);

			// Assert:
			expect(dispatchState).toHaveBeenCalledWith({ type: 'setSnapInstalled', payload: isInstalled });
		};

		it('dispatches SET_SNAP_INSTALLED action with true', () => {
			assertIsSnapInstalled(true);
		});

		it('dispatches SET_SNAP_INSTALLED action with false', () => {
			assertIsSnapInstalled(false);
		});
	});

	describe('setLoadingStatus', () => {
		const assertLoadingStatus = status => {
			// Act:
			dispatch.setLoadingStatus(status);

			// Assert:
			expect(dispatchState).toHaveBeenCalledWith({ type: 'setLoadingStatus', payload: status });
		};

		it('dispatches SET_LOADING_STATUS action with isLoading true', () => {
			assertLoadingStatus({ isLoading: true, message: 'loading' });
		});

		it('dispatches SET_LOADING_STATUS action with isLoading false', () => {
			assertLoadingStatus({ isLoading: false, message: '' });
		});
	});

	describe('setNetwork', () => {
		it('dispatches SET_NETWORK action with network', () => {
			// Arrange:
			const network = {
				identifier: 1,
				networkName: 'network',
				url: 'url',
				currencyMosaicId: 'mosaicId'
			};

			// Act:
			dispatch.setNetwork(network);

			// Assert:
			expect(dispatchState).toHaveBeenCalledWith({ type: 'setNetwork', payload: network });
		});
	});

	describe('setSelectedAccount', () => {
		it('dispatches SET_SELECTED_ACCOUNT action with account', () => {
			// Arrange:
			const account = {
				id: 'account',
				addressIndex: 1,
				type: 'metamask',
				networkName: 'network',
				label: 'label',
				address: 'address',
				publicKey: 'publicKey'
			};

			// Act:
			dispatch.setSelectedAccount(account);

			// Assert:
			expect(dispatchState).toHaveBeenCalledWith({ type: 'setSelectedAccount', payload: account });
		});
	});

	describe('setAccounts', () => {
		it('dispatches SET_ACCOUNTS action with accounts', () => {
			// Arrange:
			const accounts = {
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

			// Act:
			dispatch.setAccounts(accounts);

			// Assert:
			expect(dispatchState).toHaveBeenCalledWith({ type: 'setAccounts', payload: accounts });
		});
	});

	describe('setCurrency', () => {
		it('dispatches SET_CURRENCY action with currency', () => {
			// Arrange:
			const currency = {
				symbol: 'USD',
				price: 1
			};

			// Act:
			dispatch.setCurrency(currency);

			// Assert:
			expect(dispatchState).toHaveBeenCalledWith({ type: 'setCurrency', payload: currency });
		});
	});

	describe('setMosaicInfo', () => {
		it('dispatches SET_MOSAIC_INFO action with mosaicInfo', () => {
			// Arrange:
			const mosaicInfo = {
				'mosaicId1': {
					divisibility: 6,
					networkName: 'testnet'
				},
				'mosaicId2': {
					divisibility: 2,
					networkName: 'testnet'
				}
			};

			// Act:
			dispatch.setMosaicInfo(mosaicInfo);

			// Assert:
			expect(dispatchState).toHaveBeenCalledWith({ type: 'setMosaicInfo', payload: mosaicInfo });
		});
	});

	describe('setTransactions', () => {
		it('dispatches SET_TRANSACTIONS action with transactions', () => {
			// Arrange:
			const transactions = [
				{
					id: 'transaction1',
					transactionInfo: 'info1'
				},
				{
					id: 'transaction2',
					transactionInfo: 'info2'
				}
			];

			// Act:
			dispatch.setTransactions(transactions);

			// Assert:
			expect(dispatchState).toHaveBeenCalledWith({ type: 'setTransactions', payload: transactions });
		});
	});

	describe('setWebsocket', () => {
		it('dispatches SET_WEBSOCKET action with websocket', () => {
			// Arrange:
			const websocket = {
				url: 'url',
				listenConfirmedTransaction: jest.fn(),
				removeSubscriber: jest.fn()
			};

			// Act:
			dispatch.setWebsocket(websocket);

			// Assert:
			expect(dispatchState).toHaveBeenCalledWith({ type: 'setWebsocket', payload: websocket });
		});
	});
});
