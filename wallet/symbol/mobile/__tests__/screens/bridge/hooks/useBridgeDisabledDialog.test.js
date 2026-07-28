import { useBridgeDisabledDialog } from '@/app/screens/bridge/hooks/useBridgeDisabledDialog';
import { BridgePairsStatus } from '@/app/screens/bridge/types/Bridge';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';
import { mockRouter } from '__tests__/mock-helpers';
import { act } from '@testing-library/react-native';

// Constants

const PairsStatus = {
	DISABLED: BridgePairsStatus.DISABLED,
	NO_PAIRS: BridgePairsStatus.NO_PAIRS,
	OK: BridgePairsStatus.OK,
	LOADING: BridgePairsStatus.LOADING
};

// Hook Helpers

const createHookParams = overrides => ({
	pairsStatus: PairsStatus.DISABLED,
	...overrides
});

describe('hooks/useBridgeDisabledDialog', () => {
	let router;

	beforeEach(() => {
		jest.clearAllMocks();
		router = mockRouter({
			goBack: jest.fn()
		});
	});

	runHookContractTest(useBridgeDisabledDialog, {
		props: [createHookParams()],
		contract: {
			isVisible: 'boolean',
			onClose: 'function',
			onScreenFocus: 'function'
		}
	});

	describe('initialization', () => {
		const runInitializationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const params = createHookParams(config);

				// Act:
				const hookTester = new HookTester(useBridgeDisabledDialog, [params]);

				// Assert:
				expect(hookTester.currentResult.isVisible).toBe(expected.isVisible);
			});
		};

		const initializationTests = [
			{
				description: 'shows dialog initially when pairs status is disabled',
				config: {
					pairsStatus: PairsStatus.DISABLED
				},
				expected: {
					isVisible: true
				}
			},
			{
				// The missing account case has its own dialog, this one must stay out of its way.
				description: 'hides dialog initially when pairs status is no_pairs',
				config: {
					pairsStatus: PairsStatus.NO_PAIRS
				},
				expected: {
					isVisible: false
				}
			},
			{
				description: 'hides dialog initially when pairs status is ok',
				config: {
					pairsStatus: PairsStatus.OK
				},
				expected: {
					isVisible: false
				}
			},
			{
				description: 'hides dialog initially when pairs status is loading',
				config: {
					pairsStatus: PairsStatus.LOADING
				},
				expected: {
					isVisible: false
				}
			}
		];

		initializationTests.forEach(test => {
			runInitializationTest(test.description, test.config, test.expected);
		});
	});

	describe('actions', () => {
		it('hides the dialog and leaves the screen on close', () => {
			// Arrange:
			const params = createHookParams();
			const hookTester = new HookTester(useBridgeDisabledDialog, [params]);

			// Act:
			act(() => {
				hookTester.currentResult.onClose();
			});

			// Assert:
			expect(hookTester.currentResult.isVisible).toBe(false);
			expect(router.goBack).toHaveBeenCalled();
		});
	});
});
