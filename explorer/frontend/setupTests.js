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
window.MessageChannel = jest.fn().mockImplementation(() => {
	let onmessage;
	return {
		port1: {
			set onmessage(cb) {
				onmessage = cb;
			}
		},
		port2: {
			postMessage: data => {
				onmessage?.({ data });
			}
		}
	};
});

global.$t = key => `translated_${key}`;

const originalEnv = { ...process.env };
const envMock = {
	NEXT_PUBLIC_NATIVE_MOSAIC_ID: 'nem.xem',
	NEXT_PUBLIC_NATIVE_MOSAIC_TICKER: 'XEM',
	NEXT_PUBLIC_NATIVE_MOSAIC_DIVISIBILITY: 6,
	NEXT_PUBLIC_BLOCKCHAIN_UNWIND_LIMIT: 360,
	NEXT_PUBLIC_REQUEST_TIMEOUT: 5000,
	NEXT_PUBLIC_API_BASE_URL: 'https://explorer.backend',
	NEXT_PUBLIC_SUPERNODE_API_URL: 'https://supernode.backend',
	NEXT_PUBLIC_NODELIST_URL: 'https://node.list',
	NEXT_PUBLIC_MARKET_DATA_URL: 'https://market.data',
	NEXT_PUBLIC_HISTORICAL_PRICE_URL: 'https://historical.price'
};
process.env = {
	...originalEnv,
	...envMock
};
window.appConfig = {
	NATIVE_MOSAIC_ID: envMock.NEXT_PUBLIC_NATIVE_MOSAIC_ID,
	NATIVE_MOSAIC_TICKER: envMock.NEXT_PUBLIC_NATIVE_MOSAIC_TICKER,
	NATIVE_MOSAIC_DIVISIBILITY: envMock.NEXT_PUBLIC_NATIVE_MOSAIC_DIVISIBILITY,
	BLOCKCHAIN_UNWIND_LIMIT: envMock.NEXT_PUBLIC_BLOCKCHAIN_UNWIND_LIMIT,
	REQUEST_TIMEOUT: envMock.NEXT_PUBLIC_REQUEST_TIMEOUT,
	API_BASE_URL: envMock.NEXT_PUBLIC_API_BASE_URL,
	SUPERNODE_API_URL: envMock.NEXT_PUBLIC_SUPERNODE_API_URL,
	NODELIST_URL: envMock.NEXT_PUBLIC_NODELIST_URL,
	MARKET_DATA_URL: envMock.NEXT_PUBLIC_MARKET_DATA_URL,
	HISTORICAL_PRICE_URL: envMock.NEXT_PUBLIC_HISTORICAL_PRICE_URL
};

Object.assign(global, { TextDecoder, TextEncoder });

const mockConfigContext = () => {
	const ConfigContext = require('@/contexts/ConfigContext');
	jest.spyOn(ConfigContext, 'useConfig').mockReturnValue({
		knownAccounts: {}
	});
};

beforeEach(() => {
	jest.spyOn(console, 'error').mockImplementation(jest.fn());
	jest.spyOn(console, 'warn').mockImplementation(jest.fn());
	mockConfigContext();
	setDevice('desktop');
});
