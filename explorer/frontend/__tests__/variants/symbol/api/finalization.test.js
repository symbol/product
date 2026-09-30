import {
	finalizationInfo,
	nodewatchEpochResponse,
	nodewatchHeightResponse,
	nodewatchNetworkConfigResponse
} from '../../../test-utils/finalization';
import appConfig from '@/app/config';
import * as serverUtils from '@/app/utils/server';
import { fetchFinalizationInfo } from '@/app/variants/symbol/api/finalization';

// Mocks

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

const mockNodewatchResponses = ({
	height = nodewatchHeightResponse,
	epoch = nodewatchEpochResponse,
	networkConfig = nodewatchNetworkConfigResponse
} = {}) => {
	const responseMap = {
		[`${nodewatchBaseURL}/api/symbol/height`]: height,
		[`${nodewatchBaseURL}/api/symbol/epoch`]: epoch,
		[`${nodewatchBaseURL}/api/symbol/network/config`]: networkConfig
	};

	return jest.spyOn(serverUtils, 'makeRequest').mockImplementation(url => Promise.resolve(responseMap[url]));
};

// Constants

const nodewatchBaseURL = appConfig.PUBLIC_NODEWATCH_URL;
const now = new Date('2026-09-30T12:00:00.000Z').getTime();
const blockTimeMilliseconds = 30_000;

// Tests

describe('variants/symbol/api/finalization', () => {
	beforeAll(() => {
		jest.useFakeTimers({ now });
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('requests the Nodewatch endpoints and maps the finalization info', async () => {
		// Arrange:
		const makeRequest = mockNodewatchResponses();

		// Act:
		const result = await fetchFinalizationInfo();

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${nodewatchBaseURL}/api/symbol/height`);
		expect(makeRequest).toHaveBeenCalledWith(`${nodewatchBaseURL}/api/symbol/epoch`);
		expect(makeRequest).toHaveBeenCalledWith(`${nodewatchBaseURL}/api/symbol/network/config`);
		expect(result).toEqual(finalizationInfo);
	});

	// Base scenario bounds: epoch 10 with votingSetGrouping 720 spans heights 5760..6480.
	describe('derived values', () => {
		const runDerivedValuesTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockNodewatchResponses({
					height: { ...nodewatchHeightResponse, finalizedHeight: config.finalizedHeight },
					epoch: { epoch: config.epoch }
				});

				// Act:
				const result = await fetchFinalizationInfo();

				// Assert:
				expect(result).toEqual(expect.objectContaining(expected.result));
			});
		};

		const derivedValuesCases = [
			{
				description: 'returns zero progress with a full epoch remaining at the epoch start',
				config: { epoch: 10, finalizedHeight: 5760 },
				expected: {
					result: {
						epochProgress: 0,
						remainingBlocks: 720,
						epochEndEtaTimestamp: new Date(now + (720 * blockTimeMilliseconds))
					}
				}
			},
			{
				description: 'returns full progress without an ETA at the epoch end',
				config: { epoch: 10, finalizedHeight: 6480 },
				expected: {
					result: {
						epochProgress: 1,
						remainingBlocks: 0,
						epochEndEtaTimestamp: null
					}
				}
			},
			{
				description: 'clamps progress to one when finalization is ahead of the epoch bounds',
				config: { epoch: 10, finalizedHeight: 7000 },
				expected: {
					result: {
						epochProgress: 1,
						remainingBlocks: 0,
						epochEndEtaTimestamp: null
					}
				}
			},
			{
				description: 'clamps progress to zero when finalization is behind the previous epoch',
				config: { epoch: 10, finalizedHeight: 5000 },
				expected: {
					result: {
						epochProgress: 0,
						remainingBlocks: 720,
						epochEndEtaTimestamp: new Date(now + (720 * blockTimeMilliseconds))
					}
				}
			},
			{
				description: 'handles the first epoch without an ETA',
				config: { epoch: 1, finalizedHeight: 0 },
				expected: {
					result: {
						epochStart: 0,
						epochEnd: 1,
						epochProgress: 1,
						remainingBlocks: 0,
						epochEndEtaTimestamp: null
					}
				}
			}
		];

		derivedValuesCases.forEach(({ description, config, expected }) => runDerivedValuesTest(description, config, expected));
	});

	describe('no data', () => {
		const runNoDataTest = (description, config) => {
			it(description, async () => {
				// Arrange:
				mockNodewatchResponses(config.responses);

				// Act:
				const result = await fetchFinalizationInfo();

				// Assert:
				expect(result).toBeNull();
			});
		};

		const noDataCases = [
			{
				description: 'returns null when the chain height is one',
				config: { responses: { height: { height: '1', finalizedHeight: '1' } } }
			},
			{
				description: 'returns null when the epoch is zero',
				config: { responses: { epoch: { epoch: '0' } } }
			},
			{
				description: 'returns null when the voting set grouping is zero',
				config: { responses: { networkConfig: { ...nodewatchNetworkConfigResponse, votingSetGrouping: '0' } } }
			},
			{
				description: 'returns null when the block generation time is zero',
				config: { responses: { networkConfig: { ...nodewatchNetworkConfigResponse, targetBlockGenerationTime: '0' } } }
			},
			{
				description: 'returns null when the epoch is not numeric',
				config: { responses: { epoch: { epoch: 'unavailable' } } }
			}
		];

		noDataCases.forEach(({ description, config }) => runNoDataTest(description, config));
	});
});
