import App from '@/app/app';
import { walletControllers } from '@/app/lib/controller';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockRouter, mockSplashScreen, mockWalletController } from '__tests__/mock-helpers';
import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { constants } from 'wallet-common-core';

const { ControllerEventName } = constants;

jest.mock('@/app/lib/controller', () => ({
	walletControllers: {
		additional: []
	}
}));

jest.mock('@/app/utils', () => ({
	...jest.requireActual('@/app/utils'),
	handleError: jest.fn(),
	showMessage: jest.fn()
}));

jest.mock('@/app/localization', () => ({
	$t: jest.fn(key => key),
	initLocalization: jest.fn().mockResolvedValue()
}));

jest.mock('@/app/router/RouterView', () => {
	const React = require('react');
	const { Text } = require('react-native');

	return {
		__esModule: true,
		RouterView: ({ isActive, flow }) => {
			if (!isActive)
				return null;

			return <Text>{`router-${flow}`}</Text>;
		}
	};
});

jest.mock('@/app/app/layout/RootLayout', () => {
	const React = require('react');
	const { View } = require('react-native');

	return {
		__esModule: true,
		RootLayout: ({ children }) => <View>{children}</View>
	};
});

jest.mock('@/app/components', () => {
	const actual = jest.requireActual('@/app/components');
	const { Text } = require('react-native');

	return {
		__esModule: true,
		...actual,
		PasscodeView: ({ isVisible, onSuccess }) => {
			if (!isVisible)
				return null;

			return <Text onPress={onSuccess}>passcode-unlock</Text>;
		}
	};
});

// Helper to mock additional wallet controllers
const mockWalletControllers = () => {
	const additionalControllerMock = {
		loadCache: jest.fn().mockResolvedValue(),
		connectToNetwork: jest.fn().mockResolvedValue(),
		selectNetwork: jest.fn(),
		on: jest.fn(),
		removeListener: jest.fn()
	};
	walletControllers.additional = [additionalControllerMock];

	return [additionalControllerMock];
};

describe('App', () => {
	beforeEach(() => {
		mockRouter({ goToHome: jest.fn() });
		jest.useFakeTimers();
	});

	describe('flow rendering', () => {
		const runFlowRenderingTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletController({
					hasAccounts: config.hasAccounts,
					loadCache: jest.fn().mockResolvedValue(),
					connectToNetwork: jest.fn().mockResolvedValue(),
					modules: { market: { fetchData: jest.fn() } }
				});
				mockWalletControllers();
				const splashScreenMock = mockSplashScreen();

				// Act:
				const screenTester = new ScreenTester(App);
				await screenTester.waitForTimer();

				// Assert:
				expect(splashScreenMock.hide).toHaveBeenCalled();

				if (expected.isPasscodeShown) {
					screenTester.expectText(['passcode-unlock']);
					screenTester.notExpectText([`router-${expected.flow}`]);
				} else {
					screenTester.notExpectText(['passcode-unlock']);
					screenTester.expectText([`router-${expected.flow}`]);
				}
			});
		};

		const flowTests = [
			{
				description: 'renders onboarding flow when hasAccounts=false',
				config: { hasAccounts: false },
				expected: { flow: 'onboarding', isPasscodeShown: false }
			},
			{
				description: 'renders main flow when hasAccounts=true',
				config: { hasAccounts: true },
				expected: { flow: 'main', isPasscodeShown: true }
			}
		];

		flowTests.forEach(test => {
			runFlowRenderingTest(test.description, test.config, test.expected);
		});
	});

	describe('data loading', () => {
		it('loads cache and connects to network on mount', async () => {
			// Arrange:
			const loadCacheMock = jest.fn().mockResolvedValue();
			const connectToNetworkMock = jest.fn().mockResolvedValue();
			const fetchDataMock = jest.fn();
			mockWalletController({
				hasAccounts: false,
				loadCache: loadCacheMock,
				connectToNetwork: connectToNetworkMock,
				modules: { market: { fetchData: fetchDataMock } }
			});
			const additionalControllersMock = mockWalletControllers();
			mockSplashScreen();

			// Act:
			render(<App />);
			await act(async () => {
				jest.advanceTimersByTime(100);
			});

			// Assert:
			expect(loadCacheMock).toHaveBeenCalled();
			expect(additionalControllersMock[0].loadCache).toHaveBeenCalled();
			expect(connectToNetworkMock).toHaveBeenCalled();
			expect(additionalControllersMock[0].connectToNetwork).toHaveBeenCalled();
			expect(fetchDataMock).toHaveBeenCalled();
		});

		it('hides splash screen after loading', async () => {
			// Arrange:
			mockWalletController({
				hasAccounts: false,
				loadCache: jest.fn().mockResolvedValue(),
				connectToNetwork: jest.fn().mockResolvedValue(),
				modules: { market: { fetchData: jest.fn() } }
			});
			mockWalletControllers();
			const splashScreenMock = mockSplashScreen();

			// Act:
			render(<App />);
			await act(async () => {
				jest.advanceTimersByTime(100);
			});

			// Assert:
			expect(splashScreenMock.hide).toHaveBeenCalled();
		});
	});

	describe('event subscriptions', () => {
		const runEventSubscriptionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const eventMock = jest.fn();
				mockWalletController({
					hasAccounts: false,
					loadCache: jest.fn().mockResolvedValue(),
					connectToNetwork: jest.fn().mockResolvedValue(),
					modules: { market: { fetchData: jest.fn() } },
					[config.methodName]: eventMock
				});
				mockWalletControllers();
				mockSplashScreen();

				// Act:
				const { unmount } = render(<App />);
				await act(async () => {
					jest.advanceTimersByTime(100);
				});

				if (config.lifecycle === 'unmount')
					unmount();

				// Assert:
				expected.events.forEach(event => {
					expect(eventMock).toHaveBeenCalledWith(event, expect.any(Function));
				});
			});
		};

		const mainControllerEvents = [
			ControllerEventName.WALLET_CREATE,
			ControllerEventName.WALLET_CLEAR,
			ControllerEventName.ACCOUNT_CHANGE,
			ControllerEventName.NETWORK_CHANGE,
			ControllerEventName.NEW_TRANSACTION_CONFIRMED,
			ControllerEventName.TRANSACTION_ERROR
		];

		const subscriptionTests = [
			{
				description: 'subscribes to wallet controller events on mount',
				config: { action: 'subscribes to', lifecycle: 'mount', methodName: 'on' },
				expected: { events: mainControllerEvents }
			},
			{
				description: 'unsubscribes from wallet controller events on unmount',
				config: { action: 'unsubscribes from', lifecycle: 'unmount', methodName: 'removeListener' },
				expected: { events: mainControllerEvents }
			}
		];

		subscriptionTests.forEach(test => {
			runEventSubscriptionTest(test.description, test.config, test.expected);
		});

		it('subscribes additional wallet controllers to transaction events on mount', async () => {
			// Arrange:
			mockWalletController({
				hasAccounts: false,
				loadCache: jest.fn().mockResolvedValue(),
				connectToNetwork: jest.fn().mockResolvedValue(),
				modules: { market: { fetchData: jest.fn() } }
			});
			const additionalControllersMock = mockWalletControllers();
			mockSplashScreen();

			// Act:
			render(<App />);
			await act(async () => {
				jest.advanceTimersByTime(100);
			});

			// Assert:
			expect(additionalControllersMock[0].on).toHaveBeenCalledWith(
				ControllerEventName.NEW_TRANSACTION_CONFIRMED,
				expect.any(Function)
			);
			expect(additionalControllersMock[0].on).toHaveBeenCalledWith(
				ControllerEventName.TRANSACTION_ERROR,
				expect.any(Function)
			);
		});

		it('unsubscribes additional wallet controllers on unmount', async () => {
			// Arrange:
			mockWalletController({
				hasAccounts: false,
				loadCache: jest.fn().mockResolvedValue(),
				connectToNetwork: jest.fn().mockResolvedValue(),
				modules: { market: { fetchData: jest.fn() } }
			});
			const additionalControllersMock = mockWalletControllers();
			mockSplashScreen();

			// Act:
			const { unmount } = render(<App />);
			await act(async () => {
				jest.advanceTimersByTime(100);
			});
			unmount();

			// Assert:
			expect(additionalControllersMock[0].removeListener).toHaveBeenCalledWith(
				ControllerEventName.NEW_TRANSACTION_CONFIRMED,
				expect.any(Function)
			);
			expect(additionalControllersMock[0].removeListener).toHaveBeenCalledWith(
				ControllerEventName.TRANSACTION_ERROR,
				expect.any(Function)
			);
		});
	});

	describe('passcode behavior', () => {
		it('unlocks app and shows router when passcode is successful', async () => {
			// Arrange:
			mockWalletController({
				hasAccounts: true,
				loadCache: jest.fn().mockResolvedValue(),
				connectToNetwork: jest.fn().mockResolvedValue(),
				modules: { market: { fetchData: jest.fn() } }
			});
			mockWalletControllers();
			mockSplashScreen();

			// Act:
			const { queryByText, getByText } = render(<App />);
			await act(async () => {
				jest.advanceTimersByTime(100);
			});

			// Assert - passcode should be visible initially
			expect(queryByText('passcode-unlock')).toBeTruthy();
			expect(queryByText('router-main')).toBeNull();

			// Act - simulate successful passcode entry
			const unlockButton = getByText('passcode-unlock');
			await act(async () => {
				fireEvent.press(unlockButton);
			});

			// Assert - passcode should be hidden and router should be active
			expect(queryByText('passcode-unlock')).toBeNull();
			expect(queryByText('router-main')).toBeTruthy();
		});
	});
});
