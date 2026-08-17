import { CreatedMosaicList } from '@/app/screens/mosaic/CreatedMosaicList';
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
	textTitle: 's_createdMosaicList_title',
	textDescription: 's_createdMosaicList_description',
	textFilterRevokable: 's_createdMosaicList_filter_revokable',
	textFilterSupplyMutable: 's_createdMosaicList_filter_supplyMutable',
	textFilterExpired: 's_createdMosaicList_filter_expired',
	textExpired: 's_assets_item_expired',
	buttonClear: 'button_clear',
	textEmptyList: 'message_emptyList',
	buttonCreateMosaic: 'plus'
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

const expiredTokenOverrides = {
	endHeight: CHAIN_HEIGHT - 1000,
	isUnlimitedDuration: false
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
		...expiredTokenOverrides,
		isRevokable: true
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

// Page Fixtures

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

const shortFirstPage = createTokenDefinitionPage(0, 3);

const expiredFirstPage = createTokenDefinitionPage(0, PAGE_SIZE, expiredTokenOverrides);

const underFilledFirstPage = [
	...createTokenDefinitionPage(0, PAGE_SIZE - 1, expiredTokenOverrides),
	...createTokenDefinitionPage(PAGE_SIZE - 1, 1)
];

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

// Predefined page scenarios, keyed by the fetched page number

const pagesWithSecondPageToken = {
	1: fullFirstPage,
	2: [secondPageTokenDefinition]
};

const pagesWithShortFirstPage = {
	1: shortFirstPage
};

const pagesWithExpiredFirstPage = {
	1: expiredFirstPage,
	2: [secondPageTokenDefinition]
};

const pagesWithUnderFilledFirstPage = {
	1: underFilledFirstPage
};

// Setup

const createFetchAccountMosaicsMock = ({ createdTokens, pages, isFetchFailure }) => {
	if (isFetchFailure)
		return jest.fn().mockRejectedValue(new Error('error_network'));

	if (pages)
		return jest.fn((_, searchCriteria) => Promise.resolve(pages[searchCriteria.pageNumber] ?? []));

	return jest.fn().mockResolvedValue(createdTokens);
};

const setupMocks = (config = {}) => {
	const {
		createdTokens = createdTokenDefinitions,
		pages = null,
		isFetchFailure = false
	} = config;
	const mosaicModule = {
		fetchAccountMosaics: createFetchAccountMosaicsMock({ createdTokens, pages, isFetchFailure })
	};

	mockLocalization();
	mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		networkProperties,
		currentAccount,
		currentAccountInfo: {
			mosaics: [heldRevokableToken]
		},
		isWalletReady: true,
		modules: {
			mosaic: mosaicModule
		}
	});

	return { mosaicModule };
};

// Renders the screen and waits for the initial list load

const renderCreatedMosaicListScreen = async () => {
	const screenTester = new ScreenTester(CreatedMosaicList);
	await screenTester.waitForTimer(); // complete the initial load

	return screenTester;
};

describe('screens/mosaic/CreatedMosaicList', () => {
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
			const screenTester = await renderCreatedMosaicListScreen();

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('created mosaic list', () => {
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
			const screenTester = await renderCreatedMosaicListScreen();

			// Assert:
			screenTester.expectText(expectedTexts);
			screenTester.notExpectText([expectedExpiredTokenName, SCREEN_TEXT.textExpired]);
			screenTester.expectTextCount('0', expectedZeroAmountCount);
		});
	});

	describe('filter', () => {
		const runFilterTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks();
				const screenTester = await renderCreatedMosaicListScreen();

				// Act:
				config.buttonsToPress.forEach(buttonText => screenTester.pressButton(buttonText));
				await screenTester.waitForTimer(); // flush any auto-fill fetch

				// Assert:
				screenTester.expectText(expected.visibleTexts);

				if (expected.hiddenTexts?.length > 0)
					screenTester.notExpectText(expected.hiddenTexts);
			});
		};

		const filterTests = [
			{
				description: 'shows expired created tokens when the expired chip is pressed',
				config: { buttonsToPress: [SCREEN_TEXT.textFilterExpired] },
				expected: {
					visibleTexts: [
						expectedRevokableTokenName,
						expectedSupplyMutableTokenName,
						expectedExpiredTokenName,
						SCREEN_TEXT.textExpired
					]
				}
			},
			{
				description: 'shows only active tokens with the revokable flag when the revokable chip is pressed',
				config: { buttonsToPress: [SCREEN_TEXT.textFilterRevokable] },
				expected: {
					visibleTexts: [expectedRevokableTokenName],
					hiddenTexts: [expectedSupplyMutableTokenName, expectedExpiredTokenName]
				}
			},
			{
				description: 'shows only tokens with the supply mutable flag when the supply mutable chip is pressed',
				config: { buttonsToPress: [SCREEN_TEXT.textFilterSupplyMutable] },
				expected: {
					visibleTexts: [expectedSupplyMutableTokenName],
					hiddenTexts: [expectedRevokableTokenName, expectedExpiredTokenName]
				}
			},
			{
				description: 'keeps the active filter when the other chip is pressed (filters are exclusive)',
				config: { buttonsToPress: [SCREEN_TEXT.textFilterRevokable, SCREEN_TEXT.textFilterSupplyMutable] },
				expected: {
					visibleTexts: [expectedRevokableTokenName],
					hiddenTexts: [expectedSupplyMutableTokenName, expectedExpiredTokenName]
				}
			},
			{
				description: 'shows the default list again when the filter is cleared',
				config: { buttonsToPress: [SCREEN_TEXT.textFilterRevokable, SCREEN_TEXT.buttonClear] },
				expected: {
					visibleTexts: [expectedRevokableTokenName, expectedSupplyMutableTokenName],
					hiddenTexts: [expectedExpiredTokenName]
				}
			}
		];

		filterTests.forEach(test => {
			runFilterTest(test.description, test.config, test.expected);
		});
	});

	describe('empty state', () => {
		it('renders empty list message when the account has no created tokens', async () => {
			// Arrange:
			setupMocks({ createdTokens: [] });

			// Act:
			const screenTester = await renderCreatedMosaicListScreen();

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textEmptyList]);
		});

		it('renders empty list message when the fetch fails', async () => {
			// Arrange:
			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
			setupMocks({ isFetchFailure: true });

			// Act:
			const screenTester = new ScreenTester(CreatedMosaicList);
			await screenTester.waitForTimer(); // complete the failing fetch

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textEmptyList]);
			consoleErrorSpy.mockRestore();
		});

		it('hides the empty list message while the initial load is pending', async () => {
			// Arrange:
			const pendingFetch = new Promise(() => {});
			const { mosaicModule } = setupMocks();
			mosaicModule.fetchAccountMosaics.mockReturnValue(pendingFetch);

			// Act:
			const screenTester = new ScreenTester(CreatedMosaicList);
			await screenTester.waitForTimer(); // start the pending load

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textEmptyList]);
		});
	});

	describe('pagination', () => {
		describe('scroll to end', () => {
			const runScrollToEndTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					const { mosaicModule } = setupMocks({ pages: config.pages });

					// Act:
					const screenTester = await renderCreatedMosaicListScreen();

					// Assert: only the first page is fetched and rendered initially
					expect(mosaicModule.fetchAccountMosaics).toHaveBeenCalledTimes(1);
					screenTester.expectText([expectedFirstPageTokenName]);

					// Act: reach the list end
					screenTester.scrollListToEnd();
					await screenTester.waitForTimer(); // complete any next page fetch

					// Assert:
					const expectedSearchCriteria = { pageNumber: expected.lastFetchedPageNumber, pageSize: PAGE_SIZE };
					expect(mosaicModule.fetchAccountMosaics).toHaveBeenCalledTimes(expected.fetchCallCount);
					expect(mosaicModule.fetchAccountMosaics).toHaveBeenLastCalledWith(currentAccount.address, expectedSearchCriteria);
				});
			};

			const scrollToEndTests = [
				{
					description: 'loads the next page when the list end is reached',
					config: { pages: pagesWithSecondPageToken },
					expected: { fetchCallCount: 2, lastFetchedPageNumber: 2 }
				},
				{
					description: 'fetches no further pages when the first page is short',
					config: { pages: pagesWithShortFirstPage },
					expected: { fetchCallCount: 1, lastFetchedPageNumber: 1 }
				}
			];

			scrollToEndTests.forEach(test => {
				runScrollToEndTest(test.description, test.config, test.expected);
			});
		});

		describe('auto-fill', () => {
			const runAutoFillTest = (description, config) => {
				it(description, async () => {
					// Arrange:
					const { mosaicModule } = setupMocks({ pages: config.pages });

					// Act:
					const screenTester = await renderCreatedMosaicListScreen();
					if (config.buttonToPress)
						screenTester.pressButton(config.buttonToPress);
					await screenTester.waitForTimer(); // complete the auto-fill fetch

					// Assert: the second page is fetched and only its token is shown
					expect(mosaicModule.fetchAccountMosaics).toHaveBeenCalledTimes(2);
					expect(mosaicModule.fetchAccountMosaics)
						.toHaveBeenCalledWith(currentAccount.address, { pageNumber: 2, pageSize: PAGE_SIZE });
					screenTester.expectText([expectedSecondPageTokenName]);
					screenTester.notExpectText([expectedFirstPageTokenName]);
				});
			};

			const autoFillTests = [
				{
					// The full first page has no revokable tokens; the matching token sits on the second page
					description: 'fetches further pages when the active filter leaves the list under-filled',
					config: { pages: pagesWithSecondPageToken, buttonToPress: SCREEN_TEXT.textFilterRevokable }
				},
				{
					// An active token sits on the second page
					description: 'fetches further pages when the default view hides an expired first page',
					config: { pages: pagesWithExpiredFirstPage }
				}
			];

			autoFillTests.forEach(test => {
				runAutoFillTest(test.description, test.config);
			});
		});

		it('shows a page loading indicator while the next page fetch is pending', async () => {
			// Arrange: the under-filled first page triggers auto-fill; the next page fetch never settles
			const pendingFetch = new Promise(() => {});
			const { mosaicModule } = setupMocks({ pages: pagesWithUnderFilledFirstPage });
			const screenTester = await renderCreatedMosaicListScreen();
			mosaicModule.fetchAccountMosaics.mockReturnValue(pendingFetch);

			// Act:
			await screenTester.waitForTimer(); // start the pending auto-fill fetch

			// Assert:
			screenTester.expectLoadingIndicator();
		});

		it('restarts from the first page on pull-to-refresh', async () => {
			// Arrange:
			const { mosaicModule } = setupMocks({ pages: pagesWithSecondPageToken });

			// Act:
			const screenTester = await renderCreatedMosaicListScreen();
			screenTester.scrollListToEnd();
			await screenTester.waitForTimer(); // complete the next page fetch
			screenTester.pullToRefresh();
			await screenTester.waitForTimer(); // complete the refresh fetch

			// Assert:
			expect(mosaicModule.fetchAccountMosaics).toHaveBeenCalledTimes(3);
			expect(mosaicModule.fetchAccountMosaics)
				.toHaveBeenLastCalledWith(currentAccount.address, { pageNumber: 1, pageSize: PAGE_SIZE });
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
			const screenTester = await renderCreatedMosaicListScreen();
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
			const screenTester = await renderCreatedMosaicListScreen();
			screenTester.presButtonByLabel(SCREEN_TEXT.buttonCreateMosaic);

			// Assert:
			expect(routerMock.goToCreateMosaic).toHaveBeenCalledWith();
		});
	});
});
