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

jest.mock('symbol-sdk', () => ({
	Hash256: {
		zero: jest.fn(() => '0'.repeat(64))
	},
	PublicKey: jest.fn().mockImplementation(function (value) {
		this.value = value;
	})
}));

const base32Encode = bytes => {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let bits = 0;
	let value = 0;
	let output = '';

	bytes.forEach(byte => {
		value = (value << 8) | byte;
		bits += 8;

		while (5 <= bits) {
			output += alphabet[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	});

	if (0 < bits)
		output += alphabet[(value << (5 - bits)) & 31];

	return output;
};

const hexToBytes = hex => new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));

jest.mock('symbol-sdk/symbol', () => {
	function Network() {}

	Network.NETWORKS = [
		{
			identifier: 152,
			publicKeyToAddress: () => ({
				toString: () => 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY'
			})
		}
	];

	return {
		Address: {
			fromDecodedAddressHexString: hex => ({
				toString: () => base32Encode(hexToBytes(hex))
			})
		},
		generateNamespacePath: name => {
			const namespaceIds = {
				'pasomi.sn': [0xC440B80BCE158950n, 0xCC5FD5CF9AB1A84An],
				'symbol.xym': [0xA95F1F8A96159516n, 0xE74B99BA41F4AFEEn],
				'tes1.sub1': [0xC308F07908B26A58n, 0xDAF0482B1DA42F1En]
			};

			if (namespaceIds[name])
				return namespaceIds[name];

			if (/^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$/.test(name))
				return [0xA000000000000001n];

			throw new Error(`fully qualified name is invalid due to invalid part name (${name})`);
		},
		Network
	};
});

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
