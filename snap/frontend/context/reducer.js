export const initialState = {
	isMetamaskInstalled: false,
	isSnapInstalled: false,
	finalizedHeight: 1984644,
	currency: 'JPY',
	currencyPerXYM: 4.03,
	account: {
		label: 'Account Wallet 1',
		address: 'NDUGJWR3NASYOM4FMRCLD2UCLXEYQOVHSH4GVEI',
		publicKey: '3DF89F171990ADEFEC112080558075DC1771E9B3470770F1103EA5C0D635D47D'
	},
	mosaics: [
		{
			id: '10BA3BAA50DEB76C',
			name: 'symbol.xym',
			amount: '10.000000'
		},
		{
			id: '6B6511925501765B',
			name: null,
			amount: '10.000000'
		},
		{
			id: '6AE25FA5E8CA0646',
			name: null,
			amount: '10'
		},
		{
			id: '027C6AD49DE2C9F9',
			name: 'comsa.cms',
			amount: '10.00'
		},
		{
			id: 'B27C6AD49AE2C9F9',
			name: 'rootNamespace',
			amount: '10.00'
		}
	]
};

export const actionTypes = {
	SET_METAMASK_INSTALLED: 'setMetamaskInstalled',
	SET_SNAP_INSTALLED: 'setSnapInstalled'
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
