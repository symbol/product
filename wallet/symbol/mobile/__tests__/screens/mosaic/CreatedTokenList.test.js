import { CreatedTokenList } from '@/app/screens/mosaic/CreatedTokenList';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Mocks

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	useIsFocused: () => true
}));

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const CHAIN_HEIGHT = 150_000;
const PAGE_SIZE = 15;

// Screen Text

const SCREEN_TEXT = {
	textTitle: 's_createdTokenList_title',
	textDescription: 's_createdTokenList_description',
	textFilterRevokable: 's_createdTokenList_filter_revokable',
	textFilterSupplyMutable: 's_createdTokenList_filter_supplyMutable',
	textFilterExpired: 's_createdTokenList_filter_expired',
	textExpired: 's_assets_item_expired',
	buttonClear: 'button_clear',
	textEmptyList: 'message_emptyList',
	buttonCreateToken: 'plus'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

// Network Properties Fixtures

const networkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setChainHeight(CHAIN_HEIGHT)
	.build();

// Token Fixtures

const tokenDefinitionDefaults = {
	names: [],
	duration: 0,
	startHeight: 100,
	endHeight: 0,
	isUnlimitedDuration: true,
	creator: currentAccount.address,
	supply: '1000',
	isSupplyMutable: false,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: false
};

const revokableTokenDefinition = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.override({ ...tokenDefinitionDefaults, isRevokable: true })
	.build();

const supplyMutableTokenDefinition = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.override({ ...tokenDefinitionDefaults, names: ['supply.mutable.token'], isSupplyMutable: true })
	.build();

const expiredTokenDefinition = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.override({
		...tokenDefinitionDefaults,
		isRevokable: true,
		startHeight: 100,
		endHeight: CHAIN_HEIGHT - 1000,
		isUnlimitedDuration: false
	})
	.build();

const heldRevokableToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.override({ amount: '150' })
	.build();

const createdTokenDefinitions = [revokableTokenDefinition, supplyMutableTokenDefinition, expiredTokenDefinition];

// Expected display names (held entry provides the name, otherwise names[0] or the id)

const expectedRevokableTokenName = heldRevokableToken.name;
const expectedSupplyMutableTokenName = 'supply.mutable.token';
const expectedExpiredTokenName = expiredTokenDefinition.id;

// Page Fixtures (for pagination tests)

const createTokenDefinitionPage = (startIndex, count, overrides = {}) =>
	Array.from({ length: count }, (_, index) => TokenFixtureBuilder
		.createWithData({
			...tokenDefinitionDefaults,
			id: `PAGE_TOKEN_ID_${startIndex + index}`,
			divisibility: 0,
			names: [`page.token.${startIndex + index}`],
			...overrides
		})
		.build());

const fullFirstPage = createTokenDefinitionPage(0, PAGE_SIZE);

const secondPageTokenDefinition = TokenFixtureBuilder
	.createWithData({
		...tokenDefinitionDefaults,
		id: 'SECOND_PAGE_TOKEN_ID',
		divisibility: 0,
		names: ['second.page.token'],
		isRevokable: true
	})
	.build();

const expectedFirstPageTokenName = 'page.token.0';
const expectedSecondPageTokenName = 'second.page.token';

// Mock Factory

const createTokenModuleMock = (createdTokens = []) => ({
	fetchAccountTokens: jest.fn().mockResolvedValue(createdTokens)
});

const createPagedTokenModuleMock = pagesByNumber => ({
	fetchAccountTokens: jest.fn((_, searchCriteria) => Promise.resolve(pagesByNumber[searchCriteria.pageNumber] ?? []))
});

// Setup

const setupMocks = (config = {}) => {
	const {
		tokenModule = createTokenModuleMock(createdTokenDefinitions),
		heldTokens = [heldRevokableToken]
	} = config;

	mockLocalization();
	mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		networkProperties,
		currentAccount,
		currentAccountInfo: {
			mosaics: heldTokens
		},
		isWalletReady: true,
		modules: {
			token: tokenModule
		}
	});

	return { tokenModule };
};

describe('screens/mosaic/CreatedTokenList', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders screen text with title, description and filter chips', async () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				SCREEN_TEXT.textTitle,
				SCREEN_TEXT.textDescription,
				SCREEN_TEXT.textFilterRevokable,
				SCREEN_TEXT.textFilterSupplyMutable,
				SCREEN_TEXT.textFilterExpired,
				SCREEN_TEXT.buttonClear
			];

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('created token list', () => {
		it('renders held and zero-balance created tokens and hides expired ones by default', async () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				expectedRevokableTokenName,
				heldRevokableToken.amount,
				expectedSupplyMutableTokenName
			];
			const expectedZeroAmountCount = 1;

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load

			// Assert:
			screenTester.expectText(expectedTexts);
			screenTester.notExpectText([expectedExpiredTokenName, SCREEN_TEXT.textExpired]);
			screenTester.expectTextCount('0', expectedZeroAmountCount);
		});

		it('shows expired created tokens when the expired chip is pressed', async () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				expectedRevokableTokenName,
				expectedSupplyMutableTokenName,
				expectedExpiredTokenName,
				SCREEN_TEXT.textExpired
			];

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load
			screenTester.pressButton(SCREEN_TEXT.textFilterExpired);
			await screenTester.waitForTimer(); // flush any auto-fill fetch

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('filter', () => {
		it('shows only active tokens with the revokable flag when the revokable chip is pressed', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load
			screenTester.pressButton(SCREEN_TEXT.textFilterRevokable);

			// Assert: the expired revokable token stays hidden without the expired chip
			screenTester.expectText([expectedRevokableTokenName]);
			screenTester.notExpectText([expectedSupplyMutableTokenName, expectedExpiredTokenName]);
		});

		it('shows only tokens with the supply mutable flag when the supply mutable chip is pressed', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load
			screenTester.pressButton(SCREEN_TEXT.textFilterSupplyMutable);

			// Assert:
			screenTester.expectText([expectedSupplyMutableTokenName]);
			screenTester.notExpectText([expectedRevokableTokenName, expectedExpiredTokenName]);
		});

		it('keeps the active filter when the other chip is pressed (filters are exclusive)', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load
			screenTester.pressButton(SCREEN_TEXT.textFilterRevokable);
			screenTester.pressButton(SCREEN_TEXT.textFilterSupplyMutable);

			// Assert:
			screenTester.expectText([expectedRevokableTokenName]);
			screenTester.notExpectText([expectedSupplyMutableTokenName, expectedExpiredTokenName]);
		});

		it('shows the default list again when the filter is cleared', async () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				expectedRevokableTokenName,
				expectedSupplyMutableTokenName
			];

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load
			screenTester.pressButton(SCREEN_TEXT.textFilterRevokable);
			screenTester.pressButton(SCREEN_TEXT.buttonClear);

			// Assert:
			screenTester.expectText(expectedTexts);
			screenTester.notExpectText([expectedExpiredTokenName]);
		});
	});

	describe('empty state', () => {
		it('renders empty list message when the account has no created tokens', async () => {
			// Arrange:
			setupMocks({ tokenModule: createTokenModuleMock([]) });

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textEmptyList]);
		});

		it('renders empty list message when the fetch fails', async () => {
			// Arrange:
			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
			const tokenModule = {
				fetchAccountTokens: jest.fn().mockRejectedValue(new Error('error_network'))
			};
			setupMocks({ tokenModule });

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the failing fetch

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textEmptyList]);
			consoleErrorSpy.mockRestore();
		});
	});

	describe('pagination', () => {
		it('loads the next page when the list end is reached', async () => {
			// Arrange:
			const tokenModule = createPagedTokenModuleMock({
				1: fullFirstPage,
				2: [secondPageTokenDefinition]
			});
			setupMocks({ tokenModule });

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load

			// Assert: only the first page is fetched initially
			screenTester.expectText([expectedFirstPageTokenName]);
			expect(tokenModule.fetchAccountTokens).toHaveBeenCalledTimes(1);
			expect(tokenModule.fetchAccountTokens).toHaveBeenCalledWith(currentAccount.address, { pageNumber: 1, pageSize: PAGE_SIZE });

			// Act: reach the list end
			screenTester.scrollListToEnd();
			await screenTester.waitForTimer(); // complete the next page fetch

			// Assert: the next page is fetched and appended
			expect(tokenModule.fetchAccountTokens).toHaveBeenCalledTimes(2);
			expect(tokenModule.fetchAccountTokens).toHaveBeenCalledWith(currentAccount.address, { pageNumber: 2, pageSize: PAGE_SIZE });
		});

		it('fetches no further pages when the first page is short', async () => {
			// Arrange:
			const { tokenModule } = setupMocks();

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load
			screenTester.scrollListToEnd();
			await screenTester.waitForTimer(); // flush any next page fetch

			// Assert:
			expect(tokenModule.fetchAccountTokens).toHaveBeenCalledTimes(1);
		});

		it('auto-fetches further pages when the active filter leaves the list under-filled', async () => {
			// Arrange: the first page has no revokable tokens; the matching token sits on the second page
			const tokenModule = createPagedTokenModuleMock({
				1: fullFirstPage,
				2: [secondPageTokenDefinition]
			});
			setupMocks({ tokenModule });

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load
			screenTester.pressButton(SCREEN_TEXT.textFilterRevokable);
			await screenTester.waitForTimer(); // complete the auto-fill fetch

			// Assert: the second page is fetched automatically and its matching token is shown
			expect(tokenModule.fetchAccountTokens).toHaveBeenCalledTimes(2);
			expect(tokenModule.fetchAccountTokens).toHaveBeenCalledWith(currentAccount.address, { pageNumber: 2, pageSize: PAGE_SIZE });
			screenTester.expectText([expectedSecondPageTokenName]);
			screenTester.notExpectText([expectedFirstPageTokenName]);
		});

		it('auto-fetches further pages when the default view hides an expired first page', async () => {
			// Arrange: the whole first page is expired (hidden by default); an active token sits on the second page
			const expiredFirstPage = createTokenDefinitionPage(0, PAGE_SIZE, {
				endHeight: CHAIN_HEIGHT - 1000,
				isUnlimitedDuration: false
			});
			const tokenModule = createPagedTokenModuleMock({
				1: expiredFirstPage,
				2: [secondPageTokenDefinition]
			});
			setupMocks({ tokenModule });

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load
			await screenTester.waitForTimer(); // complete the auto-fill fetch

			// Assert: the second page is fetched automatically and its active token is shown
			expect(tokenModule.fetchAccountTokens).toHaveBeenCalledTimes(2);
			expect(tokenModule.fetchAccountTokens).toHaveBeenCalledWith(currentAccount.address, { pageNumber: 2, pageSize: PAGE_SIZE });
			screenTester.expectText([expectedSecondPageTokenName]);
			screenTester.notExpectText([expectedFirstPageTokenName]);
		});

		it('restarts from the first page on pull-to-refresh', async () => {
			// Arrange:
			const tokenModule = createPagedTokenModuleMock({
				1: fullFirstPage,
				2: [secondPageTokenDefinition]
			});
			setupMocks({ tokenModule });

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load
			screenTester.scrollListToEnd();
			await screenTester.waitForTimer(); // complete the next page fetch
			screenTester.pullToRefresh();
			await screenTester.waitForTimer(); // complete the refresh fetch

			// Assert: the refresh fetches the first page again
			expect(tokenModule.fetchAccountTokens).toHaveBeenCalledTimes(3);
			expect(tokenModule.fetchAccountTokens).toHaveBeenLastCalledWith(currentAccount.address, { pageNumber: 1, pageSize: PAGE_SIZE });
		});
	});

	describe('navigation', () => {
		it('navigates to TokenDetails screen when a token is pressed', async () => {
			// Arrange:
			setupMocks();
			const routerMock = mockRouter({
				goToTokenDetails: jest.fn()
			});

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load
			screenTester.pressButton(expectedSupplyMutableTokenName);

			// Assert:
			expect(routerMock.goToTokenDetails).toHaveBeenCalledWith({
				params: {
					chainName: CHAIN_NAME,
					accountAddress: currentAccount.address,
					tokenId: supplyMutableTokenDefinition.id,
					preloadedData: expect.objectContaining({
						id: supplyMutableTokenDefinition.id,
						amount: '0',
						name: expectedSupplyMutableTokenName
					})
				}
			});
		});

		it('navigates to CreateMosaic screen when the create token button is pressed', async () => {
			// Arrange:
			setupMocks();
			const routerMock = mockRouter({
				goToCreateMosaic: jest.fn()
			});

			// Act:
			const screenTester = new ScreenTester(CreatedTokenList);
			await screenTester.waitForTimer(); // complete the initial load
			screenTester.presButtonByLabel(SCREEN_TEXT.buttonCreateToken);

			// Assert:
			expect(routerMock.goToCreateMosaic).toHaveBeenCalledWith();
		});
	});
});
