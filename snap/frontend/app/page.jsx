'use client';

import DetectMetamask from '../components/DetectMetamask';
import HomeComponent from '../components/Home';
import { WalletContextProvider, initialState, reducer } from '../context';
import dispatchUtils from '../utils/dispatchUtils';
import symbolSnapFactory from '../utils/snap';
import detectEthereumProvider from '@metamask/detect-provider';
import React, { useEffect, useMemo, useReducer, useState } from 'react';

/**
 * Renders the main page.
 * @returns {React.JSX} The home page component.
 */
export default function Main() {
	const [walletState, dispatchState] = useReducer(reducer, initialState);
	const [provider, setProvider] = useState(null);

	const detectProvider = async () => {
		const detectedProvider = await detectEthereumProvider();
		if (detectedProvider)
			setProvider(detectedProvider);
	};

	useEffect(() => {
		detectProvider();
	}, []);

	const dispatch = useMemo(() => dispatchUtils(dispatchState), [dispatchState]);

	const symbolSnap = useMemo(() => {
		if (provider && provider.isMetaMask)
			return symbolSnapFactory.create(provider);

		return null;
	}, [provider]);

	if (!symbolSnap)
		return (<DetectMetamask isOpen={true} onRequestClose={() => false} />);;

	return (
		<WalletContextProvider value={{ walletState, dispatch, symbolSnap }}>
			<HomeComponent />
		</WalletContextProvider>
	);
}
