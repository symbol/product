import { PriceImpactSeverity } from '@/app/screens/bridge/constants';
import { createEstimationSummaryViewModel, sumFeeAmountsByToken } from '@/app/screens/bridge/utils/estimation-summary';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';
import { mockLocalization } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const TIER_LEVEL = 'medium';
const AMOUNT = '1';
const RECEIVE_AMOUNT = '99';

// Tickers resolved from the known-tokens configuration
const TICKER_XYM = 'XYM';
const TICKER_ETH = 'ETH';
const TICKER_BXYM = 'bXYM';

// Screen Text

const SCREEN_TEXT = {
	textAmountSend: 's_bridge_summary_amountSend',
	textTransactionFee: 's_bridge_summary_transactionFee',
	textOperationFee: 's_bridge_summary_bridgeFee',
	textPriceImpact: 's_bridge_summary_priceImpact',
	textPriceImpactUnknown: 's_bridge_summary_priceImpact_unknown',
	textPriceImpactHigh: 's_bridge_summary_priceImpact_high',
	textPriceImpactVeryHigh: 's_bridge_summary_priceImpact_veryHigh',
	textAmountReceive: 's_bridge_summary_amountReceive',
	textValueMissing: '-'
};

// Token Fixtures

const tokenXym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.build();

const tokenEth = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.build();

const tokenBxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.build();

// Fee Tiers Fixtures (medium tier amount: symbol 2, ethereum 1)

const symbolFeeTiers = [
	TransactionFeeFixtureBuilder
		.createWithAmounts('1', '2', '3')
		.build()
];

const ethereumFeeTiers = [
	TransactionFeeFixtureBuilder
		.createWithAmounts('0.5', '1', '2', CHAIN_NAME_ETHEREUM)
		.build()
];

// Swap Side Fixtures

const swapSideXym = {
	token: tokenXym,
	chainName: CHAIN_NAME_SYMBOL,
	networkIdentifier: NETWORK_IDENTIFIER
};

const swapSideEth = {
	token: tokenEth,
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER
};

// Step Fixtures (only the members the summary reads)

const createStep = (targetTokenInfo, targetChainName) => ({
	targetTokenInfo,
	targetWalletController: {
		chainName: targetChainName,
		networkIdentifier: NETWORK_IDENTIFIER
	}
});

const stepToBxym = createStep(tokenBxym, CHAIN_NAME_ETHEREUM);
const stepToXym = createStep(tokenXym, CHAIN_NAME_SYMBOL);

// Step Fees Fixtures

const createStepFees = (stepIndex, chainName, feeTiers) => ({
	stepIndex,
	chainName,
	networkIdentifier: NETWORK_IDENTIFIER,
	feeTiers
});

const ethereumStepFees = createStepFees(0, CHAIN_NAME_ETHEREUM, ethereumFeeTiers);
const symbolStepFees = createStepFees(0, CHAIN_NAME_SYMBOL, symbolFeeTiers);

// Estimation Fixtures

const singleStepEstimations = [
	{ bridgeFee: '1', receiveAmount: RECEIVE_AMOUNT, error: null }
];

const dualStepEstimations = [
	{ bridgeFee: '2.5', receiveAmount: '735', error: null },
	{ bridgeFee: '0.75', receiveAmount: RECEIVE_AMOUNT, error: null }
];

const failedEstimations = [
	{ bridgeFee: null, receiveAmount: null, error: { code: 'amount_low' } }
];

// Fee Amount Fixtures

const createFeeAmount = (amount, token, ticker, chainName) => ({
	amount,
	tokenId: token.id,
	ticker,
	divisibility: token.divisibility,
	chainName
});

// Row Helpers

const createRow = (title, value, isContinuation = false, severity = null) => ({
	title,
	value,
	isContinuation,
	severity
});

// Builder Helpers

const createParams = overrides => ({
	source: swapSideEth,
	target: swapSideXym,
	steps: [stepToBxym, stepToXym],
	amount: AMOUNT,
	stepFees: [ethereumStepFees, createStepFees(1, CHAIN_NAME_ETHEREUM, ethereumFeeTiers)],
	estimations: dualStepEstimations,
	priceImpact: undefined,
	priceImpactSeverity: PriceImpactSeverity.NONE,
	transactionFeeTierLevel: TIER_LEVEL,
	...overrides
});

const getRowsByTitle = (viewModel, title) => viewModel.rows.filter(row => row.title === title);

describe('screens/bridge/utils/estimation-summary', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('createEstimationSummaryViewModel', () => {
		describe('rows', () => {
			it('shows a placeholder in every row while nothing is selected', () => {
				// Arrange:
				const params = createParams({
					source: null,
					target: null,
					steps: [],
					stepFees: [],
					estimations: null,
					priceImpact: undefined
				});
				const expectedViewModel = {
					key: 'none>none',
					rows: [
						createRow(SCREEN_TEXT.textAmountSend, SCREEN_TEXT.textValueMissing),
						createRow(SCREEN_TEXT.textTransactionFee, SCREEN_TEXT.textValueMissing),
						createRow(SCREEN_TEXT.textOperationFee, SCREEN_TEXT.textValueMissing),
						createRow(SCREEN_TEXT.textPriceImpact, SCREEN_TEXT.textValueMissing),
						createRow(SCREEN_TEXT.textAmountReceive, SCREEN_TEXT.textValueMissing)
					]
				};

				// Act:
				const result = createEstimationSummaryViewModel(params);

				// Assert:
				expect(result).toStrictEqual(expectedViewModel);
			});

			it('builds the rows of the dual-step route in display order', () => {
				// Arrange: ETH → XYM, both steps' gas loaded in ETH, pool fee in bXYM, bridge fee in XYM
				const params = createParams({ priceImpact: 0.0005, priceImpactSeverity: PriceImpactSeverity.NONE });
				const expectedViewModel = {
					key: `${CHAIN_NAME_ETHEREUM}|${tokenEth.id}>${CHAIN_NAME_SYMBOL}|${tokenXym.id}`,
					rows: [
						createRow(SCREEN_TEXT.textAmountSend, `${AMOUNT} ${TICKER_ETH}`),
						createRow(SCREEN_TEXT.textTransactionFee, `2 ${TICKER_ETH}`),
						createRow(SCREEN_TEXT.textOperationFee, `2.5 ${TICKER_BXYM}`),
						createRow(SCREEN_TEXT.textOperationFee, `0.75 ${TICKER_XYM}`, true),
						createRow(SCREEN_TEXT.textPriceImpact, '0.05%'),
						createRow(SCREEN_TEXT.textAmountReceive, `${RECEIVE_AMOUNT} ${TICKER_XYM}`)
					]
				};

				// Act:
				const result = createEstimationSummaryViewModel(params);

				// Assert:
				expect(result).toStrictEqual(expectedViewModel);
			});
		});

		describe('send row', () => {
			const runSendRowTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const params = createParams({ source: config.source, amount: config.amount });

					// Act:
					const result = createEstimationSummaryViewModel(params);

					// Assert:
					expect(getRowsByTitle(result, SCREEN_TEXT.textAmountSend)).toStrictEqual([
						createRow(SCREEN_TEXT.textAmountSend, expected.value)
					]);
				});
			};

			const testCases = [
				[
					'shows the amount with the source token ticker',
					{ source: swapSideXym, amount: '1.5' },
					{ value: `1.5 ${TICKER_XYM}` }
				],
				[
					'shows a placeholder without a source',
					{ source: null, amount: '1.5' },
					{ value: SCREEN_TEXT.textValueMissing }
				]
			];

			testCases.forEach(([description, config, expected]) => runSendRowTest(description, config, expected));
		});

		describe('transaction fee rows', () => {
			const runTransactionFeeRowsTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const params = createParams({ stepFees: config.stepFees });
					const expectedRows = expected.values.map(([value, isContinuation]) =>
						createRow(SCREEN_TEXT.textTransactionFee, value, isContinuation));

					// Act:
					const result = createEstimationSummaryViewModel(params);

					// Assert:
					expect(getRowsByTitle(result, SCREEN_TEXT.textTransactionFee)).toStrictEqual(expectedRows);
				});
			};

			const testCases = [
				[
					'shows the fee of a Symbol-source route in the ticker of the fee token',
					{ stepFees: [symbolStepFees] },
					{ values: [[`2 ${TICKER_XYM}`, false]] }
				],
				[
					'adds the gas of steps paid in the same currency into one row',
					{ stepFees: [ethereumStepFees, createStepFees(1, CHAIN_NAME_ETHEREUM, ethereumFeeTiers)] },
					{ values: [[`2 ${TICKER_ETH}`, false]] }
				],
				[
					'shows the gas of a step paid in another currency on a continuation row',
					{ stepFees: [ethereumStepFees, createStepFees(1, CHAIN_NAME_SYMBOL, symbolFeeTiers)] },
					{ values: [[`1 ${TICKER_ETH}`, false], [`2 ${TICKER_XYM}`, true]] }
				],
				[
					'shows only the loaded steps while a later step is missing its fee tiers',
					{ stepFees: [ethereumStepFees, createStepFees(1, CHAIN_NAME_ETHEREUM, null)] },
					{ values: [[`1 ${TICKER_ETH}`, false]] }
				],
				[
					'shows a placeholder while no step has fee tiers',
					{ stepFees: [createStepFees(0, CHAIN_NAME_ETHEREUM, null), createStepFees(1, CHAIN_NAME_ETHEREUM, null)] },
					{ values: [[SCREEN_TEXT.textValueMissing, false]] }
				],
				[
					'shows a placeholder without steps',
					{ stepFees: [] },
					{ values: [[SCREEN_TEXT.textValueMissing, false]] }
				]
			];

			testCases.forEach(([description, config, expected]) => runTransactionFeeRowsTest(description, config, expected));
		});

		describe('operation fee rows', () => {
			const runOperationFeeRowsTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const params = createParams({ steps: config.steps, estimations: config.estimations });
					const expectedRows = expected.values.map(([value, isContinuation]) =>
						createRow(SCREEN_TEXT.textOperationFee, value, isContinuation));

					// Act:
					const result = createEstimationSummaryViewModel(params);

					// Assert:
					expect(getRowsByTitle(result, SCREEN_TEXT.textOperationFee)).toStrictEqual(expectedRows);
				});
			};

			const testCases = [
				[
					'shows each fee token on its own row in step order',
					{ steps: [stepToBxym, stepToXym], estimations: dualStepEstimations },
					{ values: [[`2.5 ${TICKER_BXYM}`, false], [`0.75 ${TICKER_XYM}`, true]] }
				],
				[
					'adds fees in the same token into one row',
					{
						steps: [stepToXym, stepToXym],
						estimations: [
							{ bridgeFee: '1.5', receiveAmount: '735', error: null },
							{ bridgeFee: '0.5', receiveAmount: RECEIVE_AMOUNT, error: null }
						]
					},
					{ values: [[`2 ${TICKER_XYM}`, false]] }
				],
				[
					'shows a placeholder without an estimation',
					{ steps: [stepToBxym, stepToXym], estimations: null },
					{ values: [[SCREEN_TEXT.textValueMissing, false]] }
				],
				[
					'shows a placeholder when a step estimation failed',
					{ steps: [stepToBxym, stepToXym], estimations: [dualStepEstimations[0], failedEstimations[0]] },
					{ values: [[SCREEN_TEXT.textValueMissing, false]] }
				],
				[
					'shows a placeholder when the estimation does not match the route steps',
					{ steps: [stepToXym], estimations: dualStepEstimations },
					{ values: [[SCREEN_TEXT.textValueMissing, false]] }
				]
			];

			testCases.forEach(([description, config, expected]) => runOperationFeeRowsTest(description, config, expected));
		});

		describe('price impact row', () => {
			const runPriceImpactRowTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const params = createParams({ priceImpact: config.priceImpact, priceImpactSeverity: config.priceImpactSeverity });

					// Act:
					const result = createEstimationSummaryViewModel(params);

					// Assert:
					expect(getRowsByTitle(result, SCREEN_TEXT.textPriceImpact)).toStrictEqual([
						createRow(SCREEN_TEXT.textPriceImpact, expected.value, false, expected.severity)
					]);
				});
			};

			const testCases = [
				[
					'shows a placeholder when no step involves a swap',
					{ priceImpact: undefined, priceImpactSeverity: PriceImpactSeverity.NONE },
					{ value: SCREEN_TEXT.textValueMissing, severity: null }
				],
				[
					'shows the unknown state with its severity when the impact could not be computed',
					{ priceImpact: null, priceImpactSeverity: PriceImpactSeverity.WARNING },
					{ value: SCREEN_TEXT.textPriceImpactUnknown, severity: PriceImpactSeverity.WARNING }
				],
				[
					'shows the percent without a level word below the warning tier',
					{ priceImpact: 0.0005, priceImpactSeverity: PriceImpactSeverity.NONE },
					{ value: '0.05%', severity: null }
				],
				[
					'shows the percent with the level word at the warning tier',
					{ priceImpact: 0.06, priceImpactSeverity: PriceImpactSeverity.WARNING },
					{ value: `6.00% · ${SCREEN_TEXT.textPriceImpactHigh}`, severity: PriceImpactSeverity.WARNING }
				],
				[
					'shows the percent with the level word at the critical tier',
					{ priceImpact: 0.2, priceImpactSeverity: PriceImpactSeverity.CRITICAL },
					{ value: `20.00% · ${SCREEN_TEXT.textPriceImpactVeryHigh}`, severity: PriceImpactSeverity.CRITICAL }
				]
			];

			testCases.forEach(([description, config, expected]) => runPriceImpactRowTest(description, config, expected));
		});

		describe('receive row', () => {
			const runReceiveRowTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const params = createParams({ target: config.target, steps: config.steps, estimations: config.estimations });

					// Act:
					const result = createEstimationSummaryViewModel(params);

					// Assert:
					expect(getRowsByTitle(result, SCREEN_TEXT.textAmountReceive)).toStrictEqual([
						createRow(SCREEN_TEXT.textAmountReceive, expected.value)
					]);
				});
			};

			const testCases = [
				[
					'shows the last step receive amount with the target token ticker',
					{ target: swapSideXym, steps: [stepToXym], estimations: singleStepEstimations },
					{ value: `${RECEIVE_AMOUNT} ${TICKER_XYM}` }
				],
				[
					'shows a placeholder without a target',
					{ target: null, steps: [stepToXym], estimations: singleStepEstimations },
					{ value: SCREEN_TEXT.textValueMissing }
				],
				[
					'shows a placeholder when the estimation failed',
					{ target: swapSideXym, steps: [stepToXym], estimations: failedEstimations },
					{ value: SCREEN_TEXT.textValueMissing }
				]
			];

			testCases.forEach(([description, config, expected]) => runReceiveRowTest(description, config, expected));
		});
	});

	describe('sumFeeAmountsByToken', () => {
		const runSumFeeAmountsTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = sumFeeAmountsByToken(config.feeAmounts);

				// Assert:
				expect(result).toStrictEqual(expected.feeAmounts);
			});
		};

		const testCases = [
			[
				'adds amounts of the same token on the same chain exactly',
				{
					feeAmounts: [
						createFeeAmount('0.000446', tokenEth, TICKER_ETH, CHAIN_NAME_ETHEREUM),
						createFeeAmount('0.000209', tokenEth, TICKER_ETH, CHAIN_NAME_ETHEREUM)
					]
				},
				{ feeAmounts: [createFeeAmount('0.000655', tokenEth, TICKER_ETH, CHAIN_NAME_ETHEREUM)] }
			],
			[
				'keeps amounts in different tokens apart in input order',
				{
					feeAmounts: [
						createFeeAmount('2.5', tokenBxym, TICKER_BXYM, CHAIN_NAME_ETHEREUM),
						createFeeAmount('0.75', tokenXym, TICKER_XYM, CHAIN_NAME_SYMBOL)
					]
				},
				{
					feeAmounts: [
						createFeeAmount('2.5', tokenBxym, TICKER_BXYM, CHAIN_NAME_ETHEREUM),
						createFeeAmount('0.75', tokenXym, TICKER_XYM, CHAIN_NAME_SYMBOL)
					]
				}
			],
			[
				'keeps the same token on different chains apart',
				{
					feeAmounts: [
						createFeeAmount('1', tokenXym, TICKER_XYM, CHAIN_NAME_SYMBOL),
						createFeeAmount('2', tokenXym, TICKER_XYM, CHAIN_NAME_ETHEREUM)
					]
				},
				{
					feeAmounts: [
						createFeeAmount('1', tokenXym, TICKER_XYM, CHAIN_NAME_SYMBOL),
						createFeeAmount('2', tokenXym, TICKER_XYM, CHAIN_NAME_ETHEREUM)
					]
				}
			],
			[
				'passes a single amount through unchanged',
				{ feeAmounts: [createFeeAmount('0.750000', tokenXym, TICKER_XYM, CHAIN_NAME_SYMBOL)] },
				{ feeAmounts: [createFeeAmount('0.750000', tokenXym, TICKER_XYM, CHAIN_NAME_SYMBOL)] }
			],
			[
				'returns no entries without amounts',
				{ feeAmounts: [] },
				{ feeAmounts: [] }
			]
		];

		testCases.forEach(([description, config, expected]) => runSumFeeAmountsTest(description, config, expected));
	});
});
