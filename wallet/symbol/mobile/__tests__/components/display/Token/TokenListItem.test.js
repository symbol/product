import { TokenListItem } from '@/app/components/display/Token/TokenListItem';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { runPressTest, runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';

// Token Fixtures

const token = TokenFixtureBuilder
	.createWithToken('symbol', 'testnet', 0)
	.setAmount('1000')
	.build();

// Constants

const TICKER = 'XYM';
const DISPLAY_NAME = `${token.name} • ${TICKER}`;
const ACCESSIBILITY_LABEL = 'token-item';
const EXPIRED_TEXT = 's_assets_item_expired';

const expiredTokenExpiration = {
	startHeight: 1_000,
	endHeight: 2_000,
	chainHeight: 3_000,
	blockGenerationTargetTime: 30
};

// Props

const createDefaultProps = (overrides = {}) => ({
	name: token.name,
	amount: token.amount,
	ticker: TICKER,
	accessibilityLabel: ACCESSIBILITY_LABEL,
	...overrides
});

describe('components/display/Token/TokenListItem', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockLocalization();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	runRenderTextTest(TokenListItem, {
		props: createDefaultProps(),
		textToRender: [
			{ type: 'text', value: DISPLAY_NAME },
			{ type: 'text', value: token.amount }
		]
	});

	describe('with an expired token expiration', () => {
		runRenderTextTest(TokenListItem, {
			props: createDefaultProps({ expiration: expiredTokenExpiration }),
			textToRender: [
				{ type: 'text', value: DISPLAY_NAME },
				{ type: 'text', value: EXPIRED_TEXT }
			]
		});
	});

	runPressTest(TokenListItem, {
		props: createDefaultProps(),
		labelToPress: ACCESSIBILITY_LABEL
	});
});
