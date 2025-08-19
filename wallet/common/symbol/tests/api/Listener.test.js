import { Listener } from '../../src/api/Listener';
import { networkProperties } from '../__fixtures__/local/network';
import { currentAccount } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
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

	describe('listenAddedTransactions', () => {
		it('subscribes and invokes handler for confirmedAdded', async () => {
			// Arrange:
			const listener = await openWithHandshake('u2');
			const callback = jest.fn();
			const expectedSubscribeRequest = {
				uid: 'u2',
				subscribe: `confirmedAdded/${address}`
			};
			const confirmedAddedEventData = { meta: { hash: 'HASH1' } };

			// Act:
			listener.listenAddedTransactions('confirmed', callback);

			// Assert:
			expect(listener.webSocket.sentMessages).toHaveLength(1);
			const subscribeRequestPayload = JSON.parse(listener.webSocket.sentMessages[0]);
			expect(subscribeRequestPayload).toEqual(expectedSubscribeRequest);

			// Act:
			listener.webSocket.emitMessage({
				topic: expectedSubscribeRequest.subscribe,
				data: confirmedAddedEventData
			});

			// Assert:
			expect(callback).toHaveBeenCalledWith({ hash: 'HASH1' });
		});
	});

	describe('listenRemovedTransactions', () => {
		it('subscribes and invokes handler for unconfirmedRemoved', async () => {
			// Arrange:
			const listener = await openWithHandshake('u3');
			const callback = jest.fn();
			const expectedSubscribeRequest = {
				uid: 'u3',
				subscribe: `unconfirmedRemoved/${address}`
			};
			const unconfirmedRemovedEventData = { meta: { hash: 'REM1' } };

			// Act:
			listener.listenRemovedTransactions('unconfirmed', callback);

			// Assert:
			expect(listener.webSocket.sentMessages).toHaveLength(1);
			const subscribeRequestPayload = JSON.parse(listener.webSocket.sentMessages[0]);
			expect(subscribeRequestPayload).toEqual(expectedSubscribeRequest);

			// Act:
			listener.webSocket.emitMessage({
				topic: expectedSubscribeRequest.subscribe,
				data: unconfirmedRemovedEventData
			});

			// Assert:
			expect(callback).toHaveBeenCalledWith({ hash: 'REM1' });
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
			// Arrange:
			const listener = await openWithHandshake('u4');
			const callback = jest.fn();
			const expectedSubscribeRequest = {
				uid: 'u4',
				subscribe: 'block'
			};
			const newBlockData = { height: 123, hash: 'B0' };

			// Act:
			listener.listenNewBlock(callback);

			// Assert:
			expect(listener.webSocket.sentMessages).toHaveLength(1);
			expect(JSON.parse(listener.webSocket.sentMessages[0])).toEqual(expectedSubscribeRequest);

			// Act:
			listener.webSocket.emitMessage({
				topic: 'block',
				data: newBlockData
			});

			// Assert:
			expect(callback).toHaveBeenCalledWith(newBlockData);
		});
	});

	describe('listenTransactionError', () => {
		it('subscribes and maps status message', async () => {
			// Arrange:
			const listener = await openWithHandshake('u5');
			const callback = jest.fn();
			const expectedSubscribeRequest = {
				uid: 'u5',
				subscribe: `status/${address}`
			};
			const transactionStatusData = { hash: 'ERR_TX', code: 'Failure_Core_Test' };
			const expectedCallbackPayload = {
				type: 'TransactionStatusError',
				rawAddress: address,
				hash: 'ERR_TX',
				code: 'Failure_Core_Test'
			};

			// Act:
			listener.listenTransactionError(callback);

			// Assert:
			expect(listener.webSocket.sentMessages).toHaveLength(1);
			expect(JSON.parse(listener.webSocket.sentMessages[0])).toEqual(expectedSubscribeRequest);

			// Act:
			listener.webSocket.emitMessage({
				topic: expectedSubscribeRequest.subscribe,
				data: transactionStatusData
			});

			// Assert:
			expect(callback).toHaveBeenCalledWith(expectedCallbackPayload);
		});
	});

	describe('handlers without dedicated subscribe methods', () => {
		it('handles COSIGNATURE and FINALIZED_BLOCK mapping when handlers are set', async () => {
			// Arrange:
			const listener = await openWithHandshake('u6');

			const cosignatureCallback = jest.fn();
			const finalizedBlockCallback = jest.fn();

			listener.handlers['cosignature'] = cosignatureCallback;
			listener.handlers['finalizedBlock'] = finalizedBlockCallback;

			const cosignatureData = { parentHash: 'PARENT', signature: 'SIG' };
			const finalizedBlockData = { height: 456, hash: 'FBH' };

			// Act:
			listener.webSocket.emitMessage({
				topic: 'cosignature',
				data: cosignatureData
			});

			// Assert:
			expect(cosignatureCallback).toHaveBeenCalledWith({
				type: 'CosignatureSignedTransaction',
				...cosignatureData
			});

			// Act:
			listener.webSocket.emitMessage({
				topic: 'finalizedBlock',
				data: finalizedBlockData
			});

			// Assert:
			expect(finalizedBlockCallback).toHaveBeenCalledWith({
				type: 'FinalizedBlock',
				...finalizedBlockData
			});
		});

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
