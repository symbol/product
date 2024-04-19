export const initialState = {
	isMetamaskInstalled: false,
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
	selectedAccount: {
		address: '',
		label: ''
	},
	mosaics: [],
	transactions: []
};

export const actionTypes = {
	SET_METAMASK_INSTALLED: 'setMetamaskInstalled',
	SET_SNAP_INSTALLED: 'setSnapInstalled',
	SET_LOADING_STATUS: 'setLoadingStatus'
};

export const reducer = (state, action) => {
	switch (action.type) {
	case actionTypes.SET_METAMASK_INSTALLED:
		return { ...state, isMetamaskInstalled: action.payload };
	case actionTypes.SET_SNAP_INSTALLED:
		return { ...state, isSnapInstalled: action.payload };
	case actionTypes.SET_LOADING_STATUS:
		return { ...state, loadingStatus: action.payload };
	default:
		return state;
	}
};
