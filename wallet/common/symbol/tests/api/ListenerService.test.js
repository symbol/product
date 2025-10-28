import { Listener } from '../../src/api/Listener';
import { ListenerService } from '../../src/api/ListenerService';
import { expect } from '@jest/globals';

describe('ListenerService', () => {
	let service;

	beforeEach(() => {
		service = new ListenerService();
	});

	it('createListener returns a Listener instance with injected WebSocket and correct fields', () => {
		// Arrange:
		const networkProperties = {
			nodeUrl: 'http://node.example:3000',
			wsUrl: 'ws://node.example:3000/ws'
		};
		const accountAddress = 'TATNE7Q5BITMUTDBC3VKOWS5ZBKPZIM5EY4BABY';
		class DummyWebSocket {
			constructor(url) {
				this.url = url;
				this.readyState = 0;
			}
			send() {}
			close() {}
		}

		// Act:
		const listener = service.createListener(networkProperties, accountAddress, DummyWebSocket);

		// Assert:
		expect(listener).toBeInstanceOf(Listener);
		expect(listener.networkProperties).toBe(networkProperties);
		expect(listener.accountAddress).toBe(accountAddress);
		expect(listener.url).toBe(networkProperties.wsUrl);
		expect(listener.websocketInjected).toBe(DummyWebSocket);

		// Initial internal state
		expect(listener.webSocket).toBeNull();
		expect(listener.handlers).toEqual({});
		expect(listener.uid).toBe('');
		expect(listener.SIGINT).toBe(false);
	});

	it('createListener returns a Listener instance without injected WebSocket when not provided', () => {
		// Arrange:
		const networkProperties = {
			nodeUrl: 'http://node.example:3000',
			wsUrl: 'ws://node.example:3000/ws'
		};
		const accountAddress = 'TB6JQF2L4J5Y6Z7X8C9V0B1N2M3K4J5H6G7F8E9D';

		// Act:
		const listener = service.createListener(networkProperties, accountAddress);

		// Assert:
		expect(listener).toBeInstanceOf(Listener);
		expect(listener.websocketInjected).toBeUndefined();
		expect(listener.url).toBe(networkProperties.wsUrl);
		expect(listener.accountAddress).toBe(accountAddress);
	});
});
