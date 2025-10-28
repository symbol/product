import { makeRequest } from '@/utils/server';
import { createContext, useContext, useEffect, useState } from 'react';

const ConfigContext = createContext({});

export const ConfigProvider = ({ children }) => {
	const [config, setConfig] = useState({});

	const fetchConfig = async () => {
		const knownAccounts = await makeRequest('/accounts/known-accounts.json');
		setConfig({
			knownAccounts
		});
	};

	useEffect(() => {
		fetchConfig();
	}, []);

	return (
		<ConfigContext.Provider value={config}>
			{children}
		</ConfigContext.Provider>
	);
};

export const useConfig = () => {
	const context = useContext(ConfigContext);

	return context;
};
