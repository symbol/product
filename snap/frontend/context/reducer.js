export const initialState = {
	isMetamaskInstalled: false,
	isSnapInstalled: false,
	isLoading: false,
	loadingMessage: '',
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
	SET_IS_LOADING: 'setIsLoading',
	SET_LOADING_MESSAGE: 'setLoadingMessage'
};

export const reducer = (state, action) => {
	switch (action.type) {
	case actionTypes.SET_METAMASK_INSTALLED:
		return { ...state, isMetamaskInstalled: action.payload };
	case actionTypes.SET_SNAP_INSTALLED:
		return { ...state, isSnapInstalled: action.payload };
	case actionTypes.SET_IS_LOADING:
		return { ...state, isLoading: action.payload };
	case actionTypes.SET_LOADING_MESSAGE:
		return { ...state, loadingMessage: action.payload };
	default:
		return state;
	}
};
