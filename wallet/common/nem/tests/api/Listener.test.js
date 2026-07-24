import { Listener } from '../../src/api/Listener';
import { outgoingTransferDTO, unconfirmedTransferDTO } from '../__fixtures__/api/transaction-dtos';
import { networkInfo } from '../__fixtures__/local/network';
import { currentAccount } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
import { ApiError } from 'wallet-common-core';

// Constants

const ADDRESS = currentAccount.address;
const WS_URL = networkInfo.wsUrl;
const FIXED_NOW = 1_700_000_000_000;

// SockJS transport frame prefixes and the STOMP frame terminator, mirroring the protocol the Listener speaks.
const SOCKJS_OPEN_FRAME = 'o';
const SOCKJS_HEARTBEAT_FRAME = 'h';
const STOMP_TERMINATOR = String.fromCharCode(0);
const CONNECTED_FRAME = `CONNECTED\nversion:1.1\n\n${STOMP_TERMINATOR}`;

// Account-scoped STOMP destinations the Listener subscribes to.
const confirmedDestination = `/transactions/${ADDRESS}`;
const unconfirmedDestination = `/unconfirmed/${ADDRESS}`;
const blockDestination = '/blocks/new';
const errorsDestination = '/errors';

// Wraps a STOMP frame for a destination into the SockJS message envelope the Listener parses (`a[<frame>]`).
const buildStompMessageFrame = (destination, rawBody) => `MESSAGE\ndestination:${destination}\n\n${rawBody}${STOMP_TERMINATOR}`;
const buildSockJsMessage = (...stompFrames) => `a${JSON.stringify(stompFrames)}`;

// Outgoing STOMP frames are wrapped by SockJS as a JSON array of a single frame string.
const parseSentStompFrame = sentMessage => JSON.parse(sentMessage)[0];

// A WebSocket stand-in that records sent frames and lets a test drive incoming frames and lifecycle events.
class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	constructor(url) {
		this.url = url;
		this.readyState = MockWebSocket.CONNECTING;
		this.onopen = null;
		this.onerror = null;
		this.onclose = null;
		this.onmessage = null;
		this.sentMessages = [];
	}

	send(data) {
		this.sentMessages.push(data);
	}

	emit(frame) {
		this.onmessage?.({ data: frame });
	}

	triggerError(error) {
		this.onerror?.(error);
	}

	close(code = 1000, reason = '') {
		this.readyState = MockWebSocket.CLOSED;
		this.onclose?.({ code, reason });
	}
}

describe('api/Listener', () => {
	beforeEach(() => {
		global.WebSocket = MockWebSocket;
		jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const createListener = () => new Listener(networkInfo, ADDRESS, MockWebSocket);

	// Drives the SockJS open + STOMP CONNECTED handshake and resolves once the listener is connected.
	const openWithHandshake = async (listener, onUnsolicitedClose) => {
		const openPromise = listener.open(onUnsolicitedClose);
		listener.webSocket.emit(SOCKJS_OPEN_FRAME);
		listener.webSocket.emit(buildSockJsMessage(CONNECTED_FRAME));
		await openPromise;

		return listener;
	};

	describe('open', () => {
		it('completes the handshake, subscribes the account and resolves with the uid set', async () => {
			// Arrange:
			const listener = createListener();

			// Act:
			const openPromise = listener.open();

			// Assert: the SockJS session URL is built from the websocket URL.
			expect(listener.webSocket).toBeInstanceOf(MockWebSocket);
			expect(listener.webSocket.url.startsWith(WS_URL)).toBe(true);

			// Act: the SockJS OPEN frame triggers the STOMP CONNECT, the CONNECTED frame completes the handshake.
			listener.webSocket.emit(SOCKJS_OPEN_FRAME);
			expect(parseSentStompFrame(listener.webSocket.sentMessages[0])).toContain('CONNECT');
			listener.webSocket.emit(buildSockJsMessage(CONNECTED_FRAME));

			// Assert:
			await expect(openPromise).resolves.toBeUndefined();
			expect(listener.uid).toBe(String(FIXED_NOW));
			const accountSubscribeFrame = parseSentStompFrame(listener.webSocket.sentMessages[1]);
			expect(accountSubscribeFrame).toContain('destination:/w/api/account/subscribe');
			expect(accountSubscribeFrame).toContain(ADDRESS);
		});

		it('resolves immediately when the socket is already open', async () => {
			// Arrange:
			const listener = await openWithHandshake(createListener());
			listener.webSocket.readyState = MockWebSocket.OPEN;
			const existingSocket = listener.webSocket;

			// Act & Assert:
			await expect(listener.open()).resolves.toBeUndefined();
			expect(listener.webSocket).toBe(existingSocket);
		});

		it('rejects with an ApiError when the socket errors', async () => {
			// Arrange:
			const listener = createListener();

			// Act:
			const openPromise = listener.open();
			listener.webSocket.triggerError(new Error('connection refused'));

			// Assert:
			await expect(openPromise).rejects.toBeInstanceOf(ApiError);
		});

		it('rejects with the close event on unsolicited close when no callback is provided', async () => {
			// Arrange:
			const listener = createListener();

			// Act:
			const openPromise = listener.open();
			listener.webSocket.close(4001, 'going away');

			// Assert:
			await expect(openPromise).rejects.toEqual({ client: '', code: 4001, reason: 'going away' });
		});

		it('invokes the close callback with the client uid on unsolicited close after the handshake', async () => {
			// Arrange:
			const onUnsolicitedClose = jest.fn();
			const listener = await openWithHandshake(createListener(), onUnsolicitedClose);

			// Act:
			listener.webSocket.close(4100, 'bye');

			// Assert:
			expect(onUnsolicitedClose).toHaveBeenCalledWith({ client: String(FIXED_NOW), code: 4100, reason: 'bye' });
		});
	});

	describe('close', () => {
		it('sets SIGINT, closes the socket and suppresses the unsolicited close callback', () => {
			// Arrange:
			const onUnsolicitedClose = jest.fn();
			const listener = createListener();
			listener.open(onUnsolicitedClose);

			// Act:
			listener.close();

			// Assert:
			expect(listener.SIGINT).toBe(true);
			expect(listener.webSocket.readyState).toBe(MockWebSocket.CLOSED);
			expect(onUnsolicitedClose).not.toHaveBeenCalled();
		});
	});

	describe('subscriptions', () => {
		const runSubscriptionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const listener = await openWithHandshake(createListener());
				const callback = jest.fn();
				listener.webSocket.sentMessages = [];

				// Act: subscribe and assert the STOMP SUBSCRIBE frame.
				config.subscribe(listener, callback);
				expect(listener.webSocket.sentMessages).toHaveLength(1);
				const subscribeFrame = parseSentStompFrame(listener.webSocket.sentMessages[0]);
				expect(subscribeFrame).toContain('SUBSCRIBE');
				expect(subscribeFrame).toContain(`destination:${expected.destination}`);

				// Act: the node pushes a message on that destination.
				const messageFrame = buildStompMessageFrame(expected.destination, JSON.stringify(config.messageBody));
				listener.webSocket.emit(buildSockJsMessage(messageFrame));

				// Assert:
				expect(callback).toHaveBeenCalledWith(expected.payload);
			});
		};

		const subscriptionTests = [
			{
				description: 'subscribes to confirmed transactions and maps the message to its hash',
				config: {
					subscribe: (listener, callback) => listener.listenAddedTransactions('confirmed', callback),
					messageBody: outgoingTransferDTO
				},
				expected: { destination: confirmedDestination, payload: { hash: outgoingTransferDTO.meta.hash.data } }
			},
			{
				description: 'subscribes to unconfirmed transactions and yields a null hash when there is no meta',
				config: {
					subscribe: (listener, callback) => listener.listenAddedTransactions('unconfirmed', callback),
					messageBody: unconfirmedTransferDTO
				},
				expected: { destination: unconfirmedDestination, payload: { hash: null } }
			},
			{
				description: 'subscribes to new blocks and maps the message to its height',
				config: {
					subscribe: (listener, callback) => listener.listenNewBlock(callback),
					messageBody: { height: networkInfo.chainHeight, timeStamp: 100, signature: 'SIG' }
				},
				expected: { destination: blockDestination, payload: { height: networkInfo.chainHeight } }
			},
			{
				description: 'subscribes to transaction errors and forwards the raw error payload',
				config: {
					subscribe: (listener, callback) => listener.listenTransactionError(callback),
					messageBody: { code: 'FAILURE_INSUFFICIENT_BALANCE', hash: outgoingTransferDTO.meta.hash.data }
				},
				expected: {
					destination: errorsDestination,
					payload: { code: 'FAILURE_INSUFFICIENT_BALANCE', hash: outgoingTransferDTO.meta.hash.data }
				}
			}
		];

		subscriptionTests.forEach(test => runSubscriptionTest(test.description, test.config, test.expected));

		it('does not subscribe for an unsupported transaction group', async () => {
			// Arrange:
			const listener = await openWithHandshake(createListener());
			listener.webSocket.sentMessages = [];

			// Act:
			listener.listenAddedTransactions('partial', jest.fn());

			// Assert:
			expect(listener.webSocket.sentMessages).toHaveLength(0);
		});
	});

	describe('message handling', () => {
		const subscribeBlock = async () => {
			const listener = await openWithHandshake(createListener());
			const callback = jest.fn();
			listener.listenNewBlock(callback);

			return { listener, callback };
		};

		it('ignores heartbeat frames', async () => {
			// Arrange:
			const { listener, callback } = await subscribeBlock();

			// Act:
			listener.webSocket.emit(SOCKJS_HEARTBEAT_FRAME);

			// Assert:
			expect(callback).not.toHaveBeenCalled();
		});

		it('ignores messages for destinations without a handler', async () => {
			// Arrange:
			const { listener, callback } = await subscribeBlock();

			// Act:
			listener.webSocket.emit(buildSockJsMessage(buildStompMessageFrame(errorsDestination, JSON.stringify({ code: 'X' }))));

			// Assert:
			expect(callback).not.toHaveBeenCalled();
		});

		it('ignores a malformed SockJS message frame', async () => {
			// Arrange:
			const { listener, callback } = await subscribeBlock();

			// Act:
			listener.webSocket.emit('a{not-json');

			// Assert:
			expect(callback).not.toHaveBeenCalled();
		});

		it('forwards the raw string when the frame body is not JSON', async () => {
			// Arrange:
			const listener = await openWithHandshake(createListener());
			const callback = jest.fn();
			listener.listenTransactionError(callback);

			// Act:
			listener.webSocket.emit(buildSockJsMessage(buildStompMessageFrame(errorsDestination, 'plain text error')));

			// Assert:
			expect(callback).toHaveBeenCalledWith('plain text error');
		});
	});
});
