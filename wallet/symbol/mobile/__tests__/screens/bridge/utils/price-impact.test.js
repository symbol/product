import { PriceImpactSeverity } from '@/app/screens/bridge/constants';
import { formatPriceImpactText, getEstimationsPriceImpact, getPriceImpactSeverity } from '@/app/screens/bridge/utils/price-impact';

// Constants

const thresholds = { warningThreshold: 0.05, criticalThreshold: 0.15 };

// Fixtures

const bridgeStepEstimation = { receiveAmount: '10', bridgeFee: '1', error: null };

const createSwapStepEstimation = priceImpact => ({
	receiveAmount: '10',
	bridgeFee: '1',
	priceImpact,
	error: null
});

describe('screens/bridge/utils/price-impact', () => {
	describe('getPriceImpactSeverity', () => {
		const runGetPriceImpactSeverityTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = getPriceImpactSeverity(config.priceImpact, thresholds);

				// Assert:
				expect(result).toBe(expected.severity);
			});
		};

		const getPriceImpactSeverityTests = [
			{
				description: 'returns none when the impact is not applicable',
				config: { priceImpact: undefined },
				expected: { severity: PriceImpactSeverity.NONE }
			},
			{
				description: 'returns warning when the impact is unknown',
				config: { priceImpact: null },
				expected: { severity: PriceImpactSeverity.WARNING }
			},
			{
				description: 'returns none for a low impact',
				config: { priceImpact: 0.01 },
				expected: { severity: PriceImpactSeverity.NONE }
			},
			{
				description: 'returns none just below the warning threshold',
				config: { priceImpact: 0.049999 },
				expected: { severity: PriceImpactSeverity.NONE }
			},
			{
				description: 'returns warning exactly at the warning threshold',
				config: { priceImpact: 0.05 },
				expected: { severity: PriceImpactSeverity.WARNING }
			},
			{
				description: 'returns warning just below the critical threshold',
				config: { priceImpact: 0.149999 },
				expected: { severity: PriceImpactSeverity.WARNING }
			},
			{
				description: 'returns critical exactly at the critical threshold',
				config: { priceImpact: 0.15 },
				expected: { severity: PriceImpactSeverity.CRITICAL }
			},
			{
				description: 'returns critical for an extreme impact',
				config: { priceImpact: 0.82 },
				expected: { severity: PriceImpactSeverity.CRITICAL }
			}
		];

		getPriceImpactSeverityTests.forEach(test => {
			runGetPriceImpactSeverityTest(test.description, test.config, test.expected);
		});
	});

	describe('formatPriceImpactText', () => {
		const runFormatPriceImpactTextTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = formatPriceImpactText(config.priceImpact);

				// Assert:
				expect(result).toBe(expected.text);
			});
		};

		const formatPriceImpactTextTests = [
			{
				description: 'returns an empty string for an unknown impact',
				config: { priceImpact: null },
				expected: { text: '' }
			},
			{
				description: 'returns the floor text for a dust impact',
				config: { priceImpact: 0.00009 },
				expected: { text: '<0.01%' }
			},
			{
				description: 'formats a typical impact with two decimals',
				config: { priceImpact: 0.20331 },
				expected: { text: '20.33%' }
			},
			{
				description: 'formats the warning threshold value',
				config: { priceImpact: 0.05 },
				expected: { text: '5.00%' }
			},
			{
				description: 'formats a full impact',
				config: { priceImpact: 1 },
				expected: { text: '100.00%' }
			}
		];

		formatPriceImpactTextTests.forEach(test => {
			runFormatPriceImpactTextTest(test.description, test.config, test.expected);
		});
	});

	describe('getEstimationsPriceImpact', () => {
		const runGetEstimationsPriceImpactTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = getEstimationsPriceImpact(config.estimations);

				// Assert:
				expect(result).toBe(expected.priceImpact);
			});
		};

		const getEstimationsPriceImpactTests = [
			{
				description: 'returns undefined when there are no estimations',
				config: { estimations: null },
				expected: { priceImpact: undefined }
			},
			{
				description: 'returns undefined when no step has a price impact',
				config: { estimations: [bridgeStepEstimation] },
				expected: { priceImpact: undefined }
			},
			{
				description: 'returns the impact of the swap step',
				config: { estimations: [createSwapStepEstimation(0.2), bridgeStepEstimation] },
				expected: { priceImpact: 0.2 }
			},
			{
				description: 'returns null when the swap step impact is unknown',
				config: { estimations: [createSwapStepEstimation(null), bridgeStepEstimation] },
				expected: { priceImpact: null }
			}
		];

		getEstimationsPriceImpactTests.forEach(test => {
			runGetEstimationsPriceImpactTest(test.description, test.config, test.expected);
		});
	});
});
