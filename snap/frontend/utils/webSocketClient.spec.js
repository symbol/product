import webSocketClient from './webSocketClient';

class MockWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
}

global.WebSocket = MockWebSocket;

describe('webSocketClient', () => {
	let wsInstance;

	beforeEach(() => {
		jest.clearAllMocks();
		wsInstance = webSocketClient.create('http://example.com');
	});

	it('create with the correct websocket URL', () => {
		// assert:
		expect(wsInstance.url).toBe('ws://example.com/ws');
	});

	it('open the websocket connection and set uid', async () => {
		// Arrange + Act:
		wsInstance.open();

		const mockMessage = { data: JSON.stringify({ uid: '12345' }) };
		wsInstance.webSocket.onmessage(mockMessage);

		// Assert:
		expect(wsInstance.uid).toBe('12345');
	});

	it('close the websocket connection', () => {
		// Arrange:
		wsInstance.webSocket = {
			...wsInstance.webSocket,
			readyState: 1,
			close: jest.fn()
		};

		// Act:
		wsInstance.close();

		// Assert:
		expect(wsInstance.webSocket.close).toHaveBeenCalled();
	});

	it('can subscribe to a channel', async () => {
		// Arrange:
		wsInstance.webSocket = {
			send: jest.fn()
		};
		wsInstance.uid = '1';

		// Act:
		wsInstance.subscribeTo('channel');

		// Assert:
		expect(wsInstance.webSocket.send).toHaveBeenCalledWith('{"uid":"1","subscribe":"channel"}');
	});
});
