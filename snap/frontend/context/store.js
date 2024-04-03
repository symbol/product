import { createContext, useContext } from 'react';

const WalletContext = createContext();

export const useWalletContext = () => {
	const context = useContext(WalletContext);
	return context;
};

export default WalletContext.Provider;
