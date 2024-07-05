// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { setDevice } from './__tests__/test-utils/device';
import { TextEncoder, TextDecoder } from 'util';

global.$t = key => `translated_${key}`;

const originalEnv = { ...process.env };
const envMock = {
	NEXT_PUBLIC_NATIVE_MOSAIC_ID: 'nem.xem',
	NEXT_PUBLIC_NATIVE_MOSAIC_TICKER: 'XEM',
	NEXT_PUBLIC_NATIVE_MOSAIC_DIVISIBILITY: 6,
	NEXT_PUBLIC_BLOCKCHAIN_UNWIND_LIMIT: 360,
	NEXT_PUBLIC_REQUEST_TIMEOUT: 5000,
	NEXT_PUBLIC_API_BASE_URL: 'https://explorer.backend',
	NEXT_PUBLIC_SUPERNODE_STATS_URL: 'https://supernode.stats',
	NEXT_PUBLIC_NODELIST_URL: 'https://node.list',
	NEXT_PUBLIC_MARKET_DATA_URL: 'https://market.data',
	NEXT_PUBLIC_HISTORICAL_PRICE_URL: 'https://historical.price'
};
process.env = {
	...originalEnv,
	...envMock
};

Object.assign(global, { TextDecoder, TextEncoder });

beforeEach(() => {
	jest.spyOn(console, 'error').mockImplementation(jest.fn());
	jest.spyOn(console, 'warn').mockImplementation(jest.fn());
	setDevice('desktop');
});
