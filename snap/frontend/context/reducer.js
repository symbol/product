export const initialState = {
	isMetamaskInstalled: false,
	isSnapInstalled: false,
	isLoading: false,
	loadingMessage: '',
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
