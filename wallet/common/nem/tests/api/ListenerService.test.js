import { Listener } from '../../src/api/Listener';
import { ListenerService } from '../../src/api/ListenerService';
import { networkInfo } from '../__fixtures__/local/network';
import { currentAccount } from '../__fixtures__/local/wallet';

// Constants

const ACCOUNT_ADDRESS = currentAccount.address;

// A minimal WebSocket stand-in passed through createListener untouched.
class DummyWebSocket {
	constructor(url) {
		this.url = url;
		this.readyState = 0;
	}

	send() {}

	close() {}
}

describe('api/ListenerService', () => {
	let listenerService;

	beforeEach(() => {
		listenerService = new ListenerService();
	});

	describe('createListener', () => {
		it('creates a Listener wired with the injected WebSocket and the initial state', () => {
			// Act:
			const listener = listenerService.createListener(networkInfo, ACCOUNT_ADDRESS, DummyWebSocket);

			// Assert:
			expect(listener).toBeInstanceOf(Listener);
			expect(listener.networkProperties).toBe(networkInfo);
			expect(listener.accountAddress).toBe(ACCOUNT_ADDRESS);
			expect(listener.url).toBe(networkInfo.wsUrl);
			expect(listener.websocketInjected).toBe(DummyWebSocket);
			expect(listener.webSocket).toBeNull();
			expect(listener.handlers).toEqual({});
			expect(listener.uid).toBe('');
			expect(listener.SIGINT).toBe(false);
		});

		it('creates a Listener without an injected WebSocket when none is provided', () => {
			// Act:
			const listener = listenerService.createListener(networkInfo, ACCOUNT_ADDRESS);

			// Assert:
			expect(listener).toBeInstanceOf(Listener);
			expect(listener.websocketInjected).toBeUndefined();
			expect(listener.url).toBe(networkInfo.wsUrl);
			expect(listener.accountAddress).toBe(ACCOUNT_ADDRESS);
		});
	});
});
