import { useWalletRefreshLifecycle } from '@/app/hooks';
import { HookTester } from '__tests__/HookTester';
import { createWalletControllerMock } from '__tests__/mock-helpers';
import { constants } from 'wallet-common-core';

const { ControllerEventName } = constants;

// Constants

// The events the hook subscribes to by default: one transaction event, and two wallet lifecycle events
const SUBSCRIBED_EVENT_COUNT = 3;

// Mock Creators

const createCallbacks = () => ({
	onRefresh: jest.fn(),
	onClear: jest.fn()
});

const createLifecycleTester = (walletController, callbacks) => new HookTester(
	useWalletRefreshLifecycle,
	[{ walletController, ...callbacks }]
);

describe('hooks/useWalletRefreshLifecycle', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('event handling', () => {
		// The listeners are registered once, so an event must reach the callbacks of the latest render.
		// Otherwise the screen refreshes the data it was mounted with, instead of the data selected on it
		const runLatestCallbackTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const walletController = createWalletControllerMock();
				const initialCallbacks = createCallbacks();
				const latestCallbacks = createCallbacks();
				const hookTester = createLifecycleTester(walletController, initialCallbacks);
				hookTester.updateProps([{ walletController, ...latestCallbacks }]);

				// Act:
				walletController.emit(config.eventName);
				// Wait for the refresh the hook schedules after the database update latency
				await hookTester.waitForTimer();

				// Assert:
				expect(latestCallbacks.onRefresh).toHaveBeenCalledTimes(1);
				expect(latestCallbacks.onClear).toHaveBeenCalledTimes(expected.clearCallCount);
				expect(initialCallbacks.onRefresh).not.toHaveBeenCalled();
				expect(initialCallbacks.onClear).not.toHaveBeenCalled();
			});
		};

		const eventTests = [
			{
				description: 'refreshes with the latest callbacks when a transaction is confirmed',
				config: { eventName: ControllerEventName.NEW_TRANSACTION_CONFIRMED },
				expected: { clearCallCount: 0 }
			},
			{
				description: 'refreshes with the latest callbacks when the network is connected',
				config: { eventName: ControllerEventName.NETWORK_CONNECTED },
				expected: { clearCallCount: 0 }
			},
			{
				description: 'clears and refreshes with the latest callbacks when the account changes',
				config: { eventName: ControllerEventName.ACCOUNT_CHANGE },
				expected: { clearCallCount: 1 }
			}
		];

		eventTests.forEach(test => {
			runLatestCallbackTest(test.description, test.config, test.expected);
		});

		it('does not refresh on account change when the wallet is not ready', async () => {
			// Arrange:
			const walletController = createWalletControllerMock({ isWalletReady: false });
			const callbacks = createCallbacks();
			const hookTester = createLifecycleTester(walletController, callbacks);

			// Act:
			walletController.emit(ControllerEventName.ACCOUNT_CHANGE);
			// Wait for a refresh that must never be scheduled
			await hookTester.waitForTimer();

			// Assert:
			expect(callbacks.onClear).toHaveBeenCalledTimes(1);
			expect(callbacks.onRefresh).not.toHaveBeenCalled();
		});
	});

	describe('subscription', () => {
		it('registers the listeners once, no matter how many times the screen renders', () => {
			// Arrange:
			const walletController = createWalletControllerMock();
			const hookTester = createLifecycleTester(walletController, createCallbacks());

			// Act:
			hookTester.updateProps([{ walletController, ...createCallbacks() }]);
			hookTester.updateProps([{ walletController, ...createCallbacks() }]);

			// Assert:
			expect(walletController.on).toHaveBeenCalledTimes(SUBSCRIBED_EVENT_COUNT);
			expect(walletController.removeListener).not.toHaveBeenCalled();
		});

		it('cancels the scheduled refresh when the screen is unmounted', async () => {
			// Arrange:
			const walletController = createWalletControllerMock();
			const callbacks = createCallbacks();
			const hookTester = createLifecycleTester(walletController, callbacks);

			// Act:
			walletController.emit(ControllerEventName.NEW_TRANSACTION_CONFIRMED);
			hookTester.unmount();
			// Wait for the scheduled refresh, which the unmount cleanup must have cancelled
			await hookTester.waitForTimer();

			// Assert:
			expect(callbacks.onRefresh).not.toHaveBeenCalled();
		});
	});
});
