import '@testing-library/jest-dom';
import { setDevice } from './__tests__/test-utils/device';
import { TextEncoder, TextDecoder } from 'util';
import 'react-intersection-observer/test-utils';

jest.mock('@/app/contexts/ConfigContext', () => ({
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
// Mirrors the runtime config keys (see config/index.js). Both server-only (NEM_*) and public
// (PUBLIC_*) keys are included so isomorphic api code resolves in the jsdom test environment.
const envMock = {
	PUBLIC_NATIVE_MOSAIC_ID: 'nem.xem',
	PUBLIC_NATIVE_MOSAIC_TICKER: 'XEM',
	PUBLIC_NATIVE_MOSAIC_DIVISIBILITY: 6,
	PUBLIC_REQUEST_TIMEOUT: 5000,
	PUBLIC_API_BASE_URL: 'https://explorer.backend',
	PUBLIC_NODEWATCH_URL: 'https://node.list',
	PUBLIC_NETWORK_IDENTIFIER: 'testnet',
	PUBLIC_NEM_BLOCKCHAIN_UNWIND_LIMIT: 360,
	PUBLIC_NEM_HISTORICAL_PRICE_URL: 'https://historical.price',
	PUBLIC_NEM_SUPERNODE_API_URL: 'https://supernode.backend',
	PUBLIC_NEM_MARKET_DATA_URL: 'https://market.data'
};
process.env = {
	...originalEnv,
	...envMock
};
window.appConfig = envMock;

Object.assign(global, { TextDecoder, TextEncoder });

const mockConfigContext = () => {
	const ConfigContext = require('@/app/contexts/ConfigContext');
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
