export const initialState = {
	isSnapInstalled: false,
	loadingStatus: {
		isLoading: false,
		message: ''
	},
	finalizedHeight: 0,
	currency: {
		symbol: 'usd',
		currencyPerXYM: 0
	},
	network: {},
	selectedAccount: {},
	accounts: {},
	mosaics: [],
	transactions: []
};

export const actionTypes = {
	SET_SNAP_INSTALLED: 'setSnapInstalled',
	SET_LOADING_STATUS: 'setLoadingStatus',
	SET_NETWORK: 'setNetwork',
	SET_SELECTED_ACCOUNT: 'setSelectedAccount',
	SET_ACCOUNTS: 'setAccounts'
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
	default:
		return state;
	}
};
