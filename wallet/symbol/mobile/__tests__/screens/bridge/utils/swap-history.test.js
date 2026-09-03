import { BRIDGE_HISTORY_PAGE_SIZE } from '@/app/screens/bridge/constants';
import { BridgePayoutStatus, BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { createSwapHistoryViewModel } from '@/app/screens/bridge/utils/swap-history';
import { formatDate } from '@/app/utils';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { mockLocalization } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const REQUEST_TRANSACTION_HASH = 'ABC123DEF456789REQUEST';
const REQUEST_TIMESTAMP = 1684265310994;
const PAYOUT_AMOUNT = '99';
const ERROR_MESSAGE = 'Bridge processing error';

// Screen Text

const SCREEN_TEXT = {
	textSwapAction: 'transactionDescriptor_swap',
	textRequestDate: formatDate(REQUEST_TIMESTAMP, key => key),
	textStatusCompleted: 's_bridge_history_status_completed',
	textRequestConfirmed: 's_bridge_history_requestTransactionConfirmed',
	textPageSizeMessage: 's_bridge_history_page_size_message'
};

// Token Fixtures

const tokenXym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.build();

const tokenBxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.build();

const tokenBxymPayout = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.setAmount(PAYOUT_AMOUNT)
	.build();

// Bridge Request Fixtures

const createBridgeRequest = (overrides = {}) => ({
	sourceChainName: CHAIN_NAME_SYMBOL,
	targetChainName: CHAIN_NAME_ETHEREUM,
	sourceTokenInfo: tokenXym,
	targetTokenInfo: tokenBxym,
	requestTransaction: {
		hash: REQUEST_TRANSACTION_HASH,
		timestamp: REQUEST_TIMESTAMP
	},
	...overrides
});

const requestCompleted = createBridgeRequest({
	payoutStatus: BridgePayoutStatus.COMPLETED,
	payoutTransaction: { token: tokenBxymPayout }
});

// Request detected locally, not reported by the bridge yet
const requestPending = createBridgeRequest({
	requestStatus: BridgeRequestStatus.CONFIRMED
});

const requestFailed = createBridgeRequest({
	requestStatus: BridgeRequestStatus.ERROR,
	errorMessage: ERROR_MESSAGE
});

describe('screens/bridge/utils/swap-history', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('createSwapHistoryViewModel()', () => {
		const runCreateSwapHistoryViewModelTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createSwapHistoryViewModel({
					history: [config.request],
					networkIdentifier: NETWORK_IDENTIFIER
				});

				// Assert:
				expect(result).toStrictEqual({
					items: [{
						key: REQUEST_TRANSACTION_HASH,
						actionText: SCREEN_TEXT.textSwapAction,
						dateText: SCREEN_TEXT.textRequestDate,
						source: { chainName: CHAIN_NAME_SYMBOL, imageId: 'xym' },
						target: { chainName: CHAIN_NAME_ETHEREUM, imageId: 'bxym' },
						status: expected.status,
						amount: expected.amount,
						caption: expected.caption,
						isPending: expected.isPending,
						request: config.request
					}],
					pageSizeText: ''
				});
			});
		};

		const createSwapHistoryViewModelTests = [
			{
				description: 'shows the payout status and amount of a completed swap',
				config: { request: requestCompleted },
				expected: {
					status: { variant: 'success', iconName: 'check-circle', text: SCREEN_TEXT.textStatusCompleted },
					amount: { value: PAYOUT_AMOUNT, ticker: 'bXYM' },
					caption: { isVisible: false, text: null, textStyle: null, textType: null },
					isPending: false
				}
			},
			{
				description: 'highlights a locally detected request without status or amount',
				config: { request: requestPending },
				expected: {
					status: null,
					amount: null,
					caption: { isVisible: true, text: SCREEN_TEXT.textRequestConfirmed, textStyle: 'regular', textType: 'body' },
					isPending: true
				}
			},
			{
				description: 'shows the error of a failed request in the caption',
				config: { request: requestFailed },
				expected: {
					status: null,
					amount: null,
					caption: { isVisible: true, text: ERROR_MESSAGE, textStyle: 'error', textType: 'label' },
					isPending: false
				}
			}
		];

		createSwapHistoryViewModelTests.forEach(test =>
			runCreateSwapHistoryViewModelTest(test.description, test.config, test.expected));
	});

	describe('page size note', () => {
		const runPageSizeNoteTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const history = Array.from({ length: config.itemCount }, () => requestCompleted);

				// Act:
				const result = createSwapHistoryViewModel({ history, networkIdentifier: NETWORK_IDENTIFIER });

				// Assert:
				expect(result.pageSizeText).toBe(expected.text);
			});
		};

		const pageSizeNoteTests = [
			{
				description: 'shows the note when the page is full',
				config: { itemCount: BRIDGE_HISTORY_PAGE_SIZE },
				expected: { text: SCREEN_TEXT.textPageSizeMessage }
			},
			{
				description: 'shows nothing when the page is not full',
				config: { itemCount: BRIDGE_HISTORY_PAGE_SIZE - 1 },
				expected: { text: '' }
			}
		];

		pageSizeNoteTests.forEach(test => runPageSizeNoteTest(test.description, test.config, test.expected));
	});
});
