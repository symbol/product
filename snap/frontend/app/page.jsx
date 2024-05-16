'use client';

import HomeComponent from '../components/Home';
import { WalletContextProvider, initialState, reducer } from '../context';
import symbolSnapFactory from '../utils/snap';
import detectEthereumProvider from '@metamask/detect-provider';
import React, { useEffect, useMemo, useReducer, useState } from 'react';

/**
 * Renders the home page.
 * @returns {React.JSX} The home page component.
 */
export default function Home() {
	const [walletState, dispatch] = useReducer(reducer, initialState);
	const [provider, setProvider] = useState(null);

	const detectProvider = async () => {
		const detectedProvider = await detectEthereumProvider();
		if (detectedProvider)
			setProvider(detectedProvider);

	};

	useEffect(() => {
		detectProvider();
	}, []);

	const symbolSnap = useMemo(() => {
		if (provider && provider.isMetaMask)
			return symbolSnapFactory.create(provider);

		return null;
	}, [provider]);

	if (!symbolSnap)
		return null;

	return (
		<WalletContextProvider value={{ walletState, dispatch, symbolSnap }}>
			<HomeComponent />
		</WalletContextProvider>
	);
}
