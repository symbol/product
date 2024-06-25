const helper = {
	async setupSnap (dispatch, symbolSnap, networkName) {
		dispatch.setLoadingStatus({
			isLoading: true,
			message: 'Initializing Snap...'
		});

		const snapState = await symbolSnap.initialSnap(networkName);

		dispatch.setNetwork(snapState.network);

		let account = {};

		if (0 < Object.keys(snapState.accounts).length) {
			// set first account as selected account
			account = Object.values(snapState.accounts)[0];
			dispatch.setAccounts(snapState.accounts);
		} else {
			// create account from snap
			account = await symbolSnap.createAccount('Wallet 1');
			dispatch.setAccounts({
				[account.id]: account
			});
		}

		dispatch.setSelectedAccount(account);

		dispatch.setLoadingStatus({
			isLoading: false,
			message: ''
		});
	},
	async createNewAccount (dispatch, symbolSnap, accounts, walletName) {
		const newAccount = await symbolSnap.createAccount(walletName);

		// update account state
		dispatch.setAccounts({ ...accounts, [newAccount.id]: newAccount });
		dispatch.setSelectedAccount(newAccount);
	},
	async importAccount (dispatch, symbolSnap, accounts, accountName, privateKey) {
		const newAccount = await symbolSnap.importAccount(accountName, privateKey);

		// If user did not approve the import from metamask confirmation
		if(!newAccount)
			return;

		// update account state
		dispatch.setAccounts({ ...accounts, [newAccount.id]: newAccount });
		dispatch.setSelectedAccount(newAccount);
	}
};

export default helper;
