export const initialState = {
	isMetamaskInstalled: false,
	isSnapInstalled: false
};

export const actionTypes = {
	SET_METAMASK_INSTALLED: 'setMetamaskInstalled',
	SET_SNAP_INSTALLED: 'setSnapInstalled',
	SET_CONNECTED: 'setConnected'
};

export const reducer = (state, action) => {
	switch (action.type) {
	case actionTypes.SET_METAMASK_INSTALLED:
		return { ...state, isMetamaskInstalled: action.payload };
	case actionTypes.SET_SNAP_INSTALLED:
		return { ...state, isSnapInstalled: action.payload };
	default:
		return state;
	}
};
