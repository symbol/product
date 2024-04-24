import { createContext, useContext } from 'react';

const WalletContext = createContext();

export const useWalletContext = () => useContext(WalletContext);

export default WalletContext.Provider;
