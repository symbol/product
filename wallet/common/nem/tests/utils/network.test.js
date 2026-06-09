import { BLOCK_GENERATION_TARGET_TIME, NetworkIdentifier, NetworkType } from '../../src/constants';
import {
	createSearchUrl,
	networkIdentifierToNetworkType,
	networkTypeToIdentifier,
	parseBlockGenerationTargetTime
} from '../../src/utils';
import { networkProperties } from '../__fixtures__/local/network';

// Constants

const BASE_URL = networkProperties.nodeUrl;

describe('utils/network', () => {
	describe('networkTypeToIdentifier', () => {
		const runNetworkTypeToIdentifierTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = networkTypeToIdentifier(config.networkType);

				// Assert:
				expect(result).toBe(expected.networkIdentifier);
			});
		};

		const networkTypeToIdentifierTests = [
			{
				description: 'maps the mainnet network type to its identifier',
				config: { networkType: NetworkType.MAIN_NET },
				expected: { networkIdentifier: NetworkIdentifier.MAIN_NET }
			},
			{
				description: 'maps the testnet network type to its identifier',
				config: { networkType: NetworkType.TEST_NET },
				expected: { networkIdentifier: NetworkIdentifier.TEST_NET }
			}
		];

		networkTypeToIdentifierTests.forEach(test => runNetworkTypeToIdentifierTest(test.description, test.config, test.expected));

		it('throws for an unsupported network type', () => {
			// Act & Assert:
			expect(() => networkTypeToIdentifier(0)).toThrow('Unsupported network type');
		});
	});

	describe('networkIdentifierToNetworkType', () => {
		const runNetworkIdentifierToNetworkTypeTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = networkIdentifierToNetworkType(config.networkIdentifier);

				// Assert:
				expect(result).toBe(expected.networkType);
			});
		};

		const networkIdentifierToNetworkTypeTests = [
			{
				description: 'maps the mainnet identifier to its network type',
				config: { networkIdentifier: NetworkIdentifier.MAIN_NET },
				expected: { networkType: NetworkType.MAIN_NET }
			},
			{
				description: 'maps the testnet identifier to its network type',
				config: { networkIdentifier: NetworkIdentifier.TEST_NET },
				expected: { networkType: NetworkType.TEST_NET }
			}
		];

		networkIdentifierToNetworkTypeTests.forEach(test =>
			runNetworkIdentifierToNetworkTypeTest(test.description, test.config, test.expected));

		it('throws for an unsupported network identifier', () => {
			// Act & Assert:
			expect(() => networkIdentifierToNetworkType('devnet')).toThrow('Unsupported network identifier');
		});
	});

	describe('parseBlockGenerationTargetTime', () => {
		const runParseBlockGenerationTargetTimeTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = parseBlockGenerationTargetTime(config.value);

				// Assert:
				expect(result).toBe(expected.time);
			});
		};

		const parseBlockGenerationTargetTimeTests = [
			{
				description: 'falls back to the protocol constant when no value is provided',
				config: { value: undefined },
				expected: { time: BLOCK_GENERATION_TARGET_TIME }
			},
			{
				description: 'falls back to the protocol constant for a zero value',
				config: { value: 0 },
				expected: { time: BLOCK_GENERATION_TARGET_TIME }
			},
			{
				description: 'parses a string value to a number',
				config: { value: '15' },
				expected: { time: 15 }
			},
			{
				description: 'returns a numeric value unchanged',
				config: { value: 30 },
				expected: { time: 30 }
			}
		];

		parseBlockGenerationTargetTimeTests.forEach(test =>
			runParseBlockGenerationTargetTimeTest(test.description, test.config, test.expected));
	});

	describe('createSearchUrl', () => {
		const runCreateSearchUrlTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createSearchUrl(BASE_URL, config.path, config.searchCriteria, config.additionalConditions);

				// Assert:
				expect(result).toBe(expected.url);
			});
		};

		const createSearchUrlTests = [
			{
				description: 'builds a url with the search criteria as query parameters',
				config: { path: '/account/get', searchCriteria: { address: 'TABC' } },
				expected: { url: `${BASE_URL}/account/get?address=TABC` }
			},
			{
				description: 'merges additional conditions into the query parameters',
				config: { path: '/transactions', searchCriteria: { address: 'TABC' }, additionalConditions: { pageSize: 25 } },
				expected: { url: `${BASE_URL}/transactions?address=TABC&pageSize=25` }
			}
		];

		createSearchUrlTests.forEach(test => runCreateSearchUrlTest(test.description, test.config, test.expected));
	});
});
