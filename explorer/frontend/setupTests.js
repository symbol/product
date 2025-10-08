// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { setDevice } from './__tests__/test-utils/device';
import { TextEncoder, TextDecoder } from 'util';
import 'react-intersection-observer/test-utils';

jest.mock('@/contexts/ConfigContext', () => ({
	__esModule: true,
	useConfig: jest.fn()
}));

// React 18 scheduler expects MessageChannel which jsdom environment lacks.
window.MessageChannel = require('worker_threads').MessageChannel;

global.$t = key => `translated_${key}`;

const originalEnv = { ...process.env };
const envMock = {
	NATIVE_MOSAIC_ID: 'nem.xem',
	NATIVE_MOSAIC_TICKER: 'XEM',
	NATIVE_MOSAIC_DIVISIBILITY: 6,
	BLOCKCHAIN_UNWIND_LIMIT: 360,
	REQUEST_TIMEOUT: 5000,
	API_BASE_URL: 'https://explorer.backend',
	SUPERNODE_API_URL: 'https://supernode.backend',
	NODELIST_URL: 'https://node.list',
	MARKET_DATA_URL: 'https://market.data',
	HISTORICAL_PRICE_URL: 'https://historical.price'
};
process.env = {
	...originalEnv,
	...envMock
};
window.appConfig = envMock;

Object.assign(global, { TextDecoder, TextEncoder });

const mockConfigContext = () => {
	const ConfigContext = require('@/contexts/ConfigContext');
	jest.spyOn(ConfigContext, 'useConfig').mockReturnValue({
		knownAccounts: {}
	});
}


beforeEach(() => {
	jest.spyOn(console, 'error').mockImplementation(jest.fn());
	jest.spyOn(console, 'warn').mockImplementation(jest.fn());
	mockConfigContext();
	setDevice('desktop');
});
