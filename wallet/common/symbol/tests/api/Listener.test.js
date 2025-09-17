import { Listener } from '../../src/api/Listener';
import { networkProperties } from '../__fixtures__/local/network';
import { currentAccount } from '../__fixtures__/local/wallet';
import { describe, expect, jest } from '@jest/globals';
import { ApiError } from 'wallet-common-core';

class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	constructor(webSocketUrl) {
		this.url = webSocketUrl;
		this.readyState = MockWebSocket.CONNECTING;
		this.onopen = null;
		this.onerror = null;
		this.onclose = null;
		this.onmessage = null;
		this.sentMessages = [];
	}

	open() {
		this.readyState = MockWebSocket.OPEN;
		if (this.onopen)
			this.onopen();
	}

	send(data) {
		this.sentMessages.push(data);
	}

	emitMessage(message) {
		if (this.onmessage)
			this.onmessage({ data: JSON.stringify(message) });
	}

	error(error) {
		if (this.onerror)
			this.onerror(error);
	}

	close(code = 1000, reason = '') {
		this.readyState = MockWebSocket.CLOSED;
		if (this.onclose)
			this.onclose({ code, reason });
	}
}

describe('Listener', () => {
	const { address } = currentAccount;
	const { wsUrl: webSocketUrl } = networkProperties;

	beforeEach(() => {
		jest.clearAllMocks();
		global.WebSocket = MockWebSocket;
	});

	const openWithHandshake = async (uid = 'uid-123', onUnsolicitedCloseCallback) => {
		// Arrange:
		const listener = new Listener(networkProperties, address, MockWebSocket);

		// Act:
		const openListenerPromise = listener.open(onUnsolicitedCloseCallback);
		expect(listener.webSocket).toBeInstanceOf(MockWebSocket);
		expect(listener.webSocket.url).toBe(webSocketUrl);
		listener.webSocket.open();
		listener.webSocket.emitMessage({ uid });

		await openListenerPromise;

		// Assert:
		expect(listener.uid).toBe(uid);
		return listener;
	};

	describe('open', () => {
		it('resolves after handshake (uid) message and sets uid', async () => {
			// Arrange:
			const onUnsolicitedClose = jest.fn();
			const uid = 'abc-123';
			const listener = new Listener(networkProperties, address, MockWebSocket);

			// Act:
			const openListenerPromise = listener.open(onUnsolicitedClose);
			listener.webSocket.open();
			listener.webSocket.emitMessage({ uid });

			// Assert:
			await expect(openListenerPromise).resolves.toBeUndefined();
			expect(listener.uid).toBe(uid);
			expect(onUnsolicitedClose).not.toHaveBeenCalled();
		});

		it('rejects on unsolicited close when no callback provided', async () => {
			// Arrange:
			const listener = new Listener(networkProperties, address, MockWebSocket);

			// Act:
			const openListenerPromise = listener.open();
			// No handshake yet, unsolicited close
			listener.webSocket.close(4001, 'going away');

			// Assert:
			await expect(openListenerPromise).rejects.toEqual({
				client: '',
				code: 4001,
				reason: 'going away'
			});
		});

		it('invokes provided callback on unsolicited close with client uid', async () => {
			// Arrange:
			const onUnsolicitedClose = jest.fn();
			const uid = 'client-42';
			const listener = await openWithHandshake(uid, onUnsolicitedClose);

			// Act:
			listener.webSocket.close(4100, 'bye');

			// Assert:
			expect(onUnsolicitedClose).toHaveBeenCalledWith({
				client: uid,
				code: 4100,
				reason: 'bye'
			});
		});
	});

	describe('close', () => {
		it('sets SIGINT and does not trigger unsolicited close callback', async () => {
			// Arrange:
			const onUnsolicitedClose = jest.fn();
			const listener = new Listener(networkProperties, address, MockWebSocket);
			// Do not await; promise remains pending without uid
			listener.open(onUnsolicitedClose);
			listener.webSocket.open();

			// Act:
			listener.close();

			// Assert:
			await new Promise(resolve => setTimeout(resolve, 0));
			expect(onUnsolicitedClose).not.toHaveBeenCalled();
		});
	});

	const runChannelTest = async ({ channel, subscribe, messageToEmit, expectedResult }) => {
		// Arrange:
		const listener = await openWithHandshake('u2');
		const callback = jest.fn();
		const expectedSubscribeRequest = {
			uid: 'u2',
			subscribe: channel
		};

		// Act:
		subscribe(listener, callback);

		// Assert:
		expect(listener.webSocket.sentMessages).toHaveLength(1);
		const subscribeRequestPayload = JSON.parse(listener.webSocket.sentMessages[0]);
		expect(subscribeRequestPayload).toEqual(expectedSubscribeRequest);

		// Act:
		listener.webSocket.emitMessage({
			topic: channel,
			data: messageToEmit
		});

		// Assert:
		expect(callback).toHaveBeenCalledWith(expectedResult);
	};

	describe('listenAddedTransactions', () => {
		it('subscribes and invokes handler for confirmedAdded', async () => {
			await runChannelTest({
				channel: `confirmedAdded/${address}`,
				subscribe: (listener, cb) => listener.listenAddedTransactions('confirmed', cb),
				messageToEmit: { meta: { hash: 'HASH1' } },
				expectedResult: { hash: 'HASH1' }
			});
		});
	});

	describe('listenRemovedTransactions', () => {
		it('subscribes and invokes handler for unconfirmedRemoved', async () => {
			await runChannelTest({
				channel: `unconfirmedRemoved/${address}`,
				subscribe: (listener, cb) => listener.listenRemovedTransactions('unconfirmed', cb),
				messageToEmit: { meta: { hash: 'REM1' } },
				expectedResult: { hash: 'REM1' }
			});
		});

		it('throws ApiError for unsupported group "confirmed"', async () => {
			// Arrange:
			const listener = await openWithHandshake();

			// Act & Assert:
			expect(() => listener.listenRemovedTransactions('confirmed', jest.fn()))
				.toThrow(ApiError);
		});
	});

	describe('listenNewBlock', () => {
		it('subscribes and forwards raw block data', async () => {
			await runChannelTest({
				channel: 'block',
				subscribe: (listener, cb) => listener.listenNewBlock(cb),
				messageToEmit: { height: 123, hash: 'B0' },
				expectedResult: { height: 123, hash: 'B0' }
			});
		});
	});

	describe('finalizedBlock', () => {
		it('subscribes and forwards finalized block data', async () => {
			await runChannelTest({
				channel: 'finalizedBlock',
				subscribe: (listener, cb) => listener.listenFinalizedBlock(cb),
				messageToEmit: { height: 456, hash: 'FBH' },
				expectedResult: { height: 456, hash: 'FBH' }
			});
		});
	});

	describe('listenTransactionCosignature', () => {
		it('subscribes and forwards cosignature data', async () => {
			await runChannelTest({
				channel: 'cosignature',
				subscribe: (listener, cb) => listener.listenTransactionCosignature(cb),
				messageToEmit: { parentHash: 'PARENT', signature: 'SIG' },
				expectedResult: { parentHash: 'PARENT', signature: 'SIG' }
			});
		});
	});

	describe('listenTransactionError', () => {
		it('subscribes and maps status message', async () => {
			await runChannelTest({
				channel: `status/${address}`,
				subscribe: (listener, cb) => listener.listenTransactionError(cb),
				messageToEmit: { hash: 'ERR_TX', code: 'Failure_Core_Test' },
				expectedResult: { hash: 'ERR_TX', code: 'Failure_Core_Test' }
			});
		});
	});

	describe('handlers without dedicated subscribe methods', () => {
		it('throws ApiError for unsupported channel when handler exists', async () => {
			// Arrange:
			const listener = await openWithHandshake('u7');
			listener.handlers['unsupported'] = jest.fn();

			// Act & Assert:
			await expect(listener._handleMessage({
				topic: 'unsupported/param',
				data: {}
			})).rejects.toThrow(ApiError);
		});
	});
});
