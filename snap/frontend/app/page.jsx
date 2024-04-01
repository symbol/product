'use client';

import HomeComponent from '../components/Home';
import { WalletContext, initialState, reducer } from '../context';
import React, { useReducer } from 'react';

/**
 * Renders the home page.
 * @returns {React.JSX} The home page component.
 */
export default function Home() {
	const [walletState, dispatch] = useReducer(reducer, initialState);

	return (
		<WalletContext.Provider value={{ walletState, dispatch: dispatch }}>
			<HomeComponent />
		</WalletContext.Provider>
	);
}
