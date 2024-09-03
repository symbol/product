export const initialState = {
	isSnapInstalled: false,
	loadingStatus: {
		isLoading: false,
		message: ''
	},
	finalizedHeight: 0,
	currency: {
		symbol: 'USD',
		price: 0
	},
	network: {},
	selectedAccount: {},
	accounts: {},
	mosaics: [],
	transactions: [],
	mosaicInfo: {},
	websocket: null
};

export const actionTypes = {
	SET_SNAP_INSTALLED: 'setSnapInstalled',
	SET_LOADING_STATUS: 'setLoadingStatus',
	SET_NETWORK: 'setNetwork',
	SET_SELECTED_ACCOUNT: 'setSelectedAccount',
	SET_ACCOUNTS: 'setAccounts',
	SET_CURRENCY: 'setCurrency',
	SET_MOSAIC_INFO: 'setMosaicInfo',
	SET_TRANSACTIONS: 'setTransactions',
	SET_WEBSOCKET: 'setWebsocket',
	UPDATE_ACCOUNT: 'updateAccount'
};

export const reducer = (state, action) => {
	switch (action.type) {
	case actionTypes.SET_SNAP_INSTALLED:
		return { ...state, isSnapInstalled: action.payload };
	case actionTypes.SET_LOADING_STATUS:
		return { ...state, loadingStatus: action.payload };
	case actionTypes.SET_NETWORK:
		return { ...state, network: action.payload };
	case actionTypes.SET_SELECTED_ACCOUNT:
		return { ...state, selectedAccount: action.payload };
	case actionTypes.SET_ACCOUNTS:
		return { ...state, accounts: action.payload };
	case actionTypes.SET_CURRENCY:
		return { ...state, currency: action.payload };
	case actionTypes.SET_MOSAIC_INFO:
		return { ...state, mosaicInfo: action.payload };
	case actionTypes.SET_TRANSACTIONS:
		return { ...state, transactions: action.payload };
	case actionTypes.SET_WEBSOCKET:
		return { ...state, websocket: action.payload };
	case actionTypes.UPDATE_ACCOUNT:
		const updatedAccount = action.payload;
		const updatedState = {
			...state,
			accounts: {
				...state.accounts,
				[updatedAccount.id]: updatedAccount
			}
		};
		
		// If the updated account is the currently selected account, update selectedAccount as well
		if (state.selectedAccount && state.selectedAccount.id === updatedAccount.id) 
			updatedState.selectedAccount = updatedAccount;
		
		return updatedState;
	default:
		return state;
	}
};
