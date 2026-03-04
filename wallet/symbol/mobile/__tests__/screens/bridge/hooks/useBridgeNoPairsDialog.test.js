import { useBridgeNoPairsDialog } from '@/app/screens/bridge/hooks/useBridgeNoPairsDialog';
import { BridgePairsStatus } from '@/app/screens/bridge/types/Bridge';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';
import { mockRouter } from '__tests__/mock-helpers';

// Constants

const PairsStatus = {
	NO_PAIRS: BridgePairsStatus.NO_PAIRS,
	OK: BridgePairsStatus.OK,
	LOADING: BridgePairsStatus.LOADING
};

// Hook Helpers

const createHookParams = overrides => ({
	pairsStatus: PairsStatus.NO_PAIRS,
	...overrides
});

describe('hooks/useBridgeNoPairsDialog', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRouter({
			goBack: jest.fn(),
			goToBridgeAccountList: jest.fn()
		});
	});

	runHookContractTest(useBridgeNoPairsDialog, {
		props: [createHookParams()],
		contract: {
			isVisible: 'boolean',
			onSuccess: 'function',
			onCancel: 'function',
			onScreenFocus: 'function'
		}
	});

	describe('initialization', () => {
		const runInitializationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const params = createHookParams(config);

				// Act:
				const hookTester = new HookTester(useBridgeNoPairsDialog, [params]);

				// Assert:
				expect(hookTester.currentResult.isVisible).toBe(expected.isVisible);
			});
		};

		const initializationTests = [
			{
				description: 'shows dialog initially when pairs status is no_pairs',
				config: {
					pairsStatus: PairsStatus.NO_PAIRS
				},
				expected: {
					isVisible: true
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
});
