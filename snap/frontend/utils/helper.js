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
		} else {
			// create account from snap
			account = await symbolSnap.createAccount('Wallet 1');
		}

		dispatch.setSelectedAccount(account);

		dispatch.setLoadingStatus({
			isLoading: false,
			message: ''
		});
	}
};

export default helper;
