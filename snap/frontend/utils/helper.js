import QRCode from 'qrcode';

const helper = {
	async setupSnap (dispatch, symbolSnap, networkName, currency) {
		dispatch.setLoadingStatus({
			isLoading: true,
			message: 'Initializing Snap...'
		});

		const snapState = await symbolSnap.initialSnap(networkName, currency);

		dispatch.setNetwork(snapState.network);
		dispatch.setCurrency(snapState.currency);

		let account = {};

		if (0 < Object.keys(snapState.accounts).length) {
			// set first account as selected account
			const accountId = Object.values(snapState.accounts)[0].id;
			const accountMosaics = await symbolSnap.fetchAccountMosaics([accountId]);

			account = Object.values(accountMosaics)[0];
		} else {
			// create account from snap
			account = await symbolSnap.createAccount('Wallet 1');
		}

		dispatch.setSelectedAccount(account);

		// fetch mosaic info and accounts
		const [mosaicInfo, updateAccounts] = await Promise.all([
			symbolSnap.getMosaicInfo(),
			symbolSnap.getAccounts()
		]);

		dispatch.setMosaicInfo(mosaicInfo);
		dispatch.setAccounts(updateAccounts);

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
	},
	async generateAccountQRBase64 (label, publicKey, networkIdentifier, networkGenerationHashSeed) {
		// The content is follow symbol-qr-library format.
		const content = `{"v":3,"type":1,"network_id":${networkIdentifier},"chain_id":"${networkGenerationHashSeed}",` +
		`"data":{"name":"${label}","publicKey":"${publicKey}"}}`;

		return new Promise((resolve, reject) => {
			QRCode.toDataURL(content, function (err, base64) {
				if (err)
					reject(err);

				resolve(base64);
			});
		});
	},
	async getCurrency (dispatch, symbolSnap, symbol) {
		const currency = await symbolSnap.getCurrency(symbol);

		dispatch.setCurrency(currency);
	},
	async updateAccountAndMosaicInfoState (dispatch, symbolSnap) {
		const accounts = await symbolSnap.getAccounts();
		const accountIds = Object.values(accounts).map(account => account.id);

		await symbolSnap.fetchAccountMosaics(accountIds);

		// fetch mosaic info and accounts
		const [mosaicInfo, updateAccounts] = await Promise.all([
			symbolSnap.getMosaicInfo(),
			symbolSnap.getAccounts()
		]);

		dispatch.setMosaicInfo(mosaicInfo);
		dispatch.setAccounts(updateAccounts);
	}
};

export default helper;
