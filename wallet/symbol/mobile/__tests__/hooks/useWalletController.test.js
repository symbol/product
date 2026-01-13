import { useWalletController } from '@/app/hooks/useWalletController';
import { walletControllers } from '@/app/lib/controller';
import { act, renderHook } from '@testing-library/react-native';
import { constants } from 'wallet-common-core';

jest.mock('@/app/lib/controller', () => ({
	walletControllers: {
		main: {
			chainName: 'symbol',
			on: jest.fn(),
			removeListener: jest.fn()
		},
		additional: [
			{
				chainName: 'ethereum',
				on: jest.fn(),
				removeListener: jest.fn()
			}
		]
	}
}));

describe('hooks/useWalletController', () => {
	describe('controller selection', () => {
		const runControllerSelectionTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const { result } = renderHook(() => useWalletController(config.chainName));

				// Assert:
				expect(result.current).toBe(expected.controller);
			});
		};

		const tests = [
			{
				description: 'returns main controller when chainName is undefined',
				config: { chainName: undefined },
				expected: { controllerType: 'main', controller: walletControllers.main }
			},
			{
				description: 'returns main controller when chainName is null',
				config: { chainName: null },
				expected: { controllerType: 'main', controller: walletControllers.main }
			},
			{
				description: 'returns main controller when chainName is "symbol"',
				config: { chainName: 'symbol' },
				expected: { controllerType: 'main', controller: walletControllers.main }
			},
			{
				description: 'returns additional controller when chainName is "ethereum"',
				config: { chainName: 'ethereum' },
				expected: { controllerType: 'additional', controller: walletControllers.additional[0] }
			}
		];

		tests.forEach(test => {
			runControllerSelectionTest(test.description, test.config, test.expected);
		});
	});

	describe('event listeners', () => {
		it('subscribes to STATE_CHANGE event on mount', () => {
			// Act:
			renderHook(() => useWalletController());

			// Assert:
			expect(walletControllers.main.on).toHaveBeenCalledWith(
				constants.ControllerEventName.STATE_CHANGE,
				expect.any(Function)
			);
		});

		it('unsubscribes from STATE_CHANGE event on unmount', () => {
			// Arrange:
			const { unmount } = renderHook(() => useWalletController());

			// Act:
			unmount();

			// Assert:
			expect(walletControllers.main.removeListener).toHaveBeenCalledWith(
				constants.ControllerEventName.STATE_CHANGE,
				expect.any(Function)
			);
		});

		it('subscribes to the correct controller when chainName is provided', () => {
			// Act:
			renderHook(() => useWalletController('ethereum'));

			// Assert:
			expect(walletControllers.additional[0].on).toHaveBeenCalledWith(
				constants.ControllerEventName.STATE_CHANGE,
				expect.any(Function)
			);
		});
	});

	describe('state updates', () => {
		it('triggers re-render when STATE_CHANGE event is emitted', () => {
			// Arrange:
			let stateChangeHandler;
			walletControllers.main.on.mockImplementation((event, handler) => {
				if (event === constants.ControllerEventName.STATE_CHANGE)
					stateChangeHandler = handler;
			});

			const renderCounter = jest.fn();
			const { result } = renderHook(() => {
				renderCounter();
				return useWalletController();
			});

			// Act:
			const initialRenderCount = renderCounter.mock.calls.length;
			act(() => {
				stateChangeHandler();
			});

			// Assert:
			expect(renderCounter.mock.calls.length).toBeGreaterThan(initialRenderCount);
			expect(result.current).toBe(walletControllers.main);
		});
	});
});
