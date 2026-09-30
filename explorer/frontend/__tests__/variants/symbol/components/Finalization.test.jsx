import '@testing-library/jest-dom';
import { finalizationInfo } from '../../../test-utils/finalization';
import { DATA_REFRESH_INTERVAL } from '@/app/constants';
import { fetchFinalizationInfo } from '@/app/variants/symbol/api/finalization';
import Finalization from '@/app/variants/symbol/components/Finalization';
import { act, render, screen } from '@testing-library/react';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';

// Mocks

jest.mock('@/app/variants/symbol/api/finalization', () => ({
	__esModule: true,
	fetchFinalizationInfo: jest.fn()
}));

jest.mock('next/router', () => ({
	useRouter: () => ({ locale: 'en' })
}));

jest.mock('next-i18next', () => ({
	useTranslation: () => ({
		t: (key, options) => (undefined === options?.count ? key : `${key}:${options.count}`)
	})
}));

TimeAgo.addDefaultLocale(en);

// Constants

const SCREEN_TEXT = {
	fieldChainHeight: 'field_chainHeight',
	fieldFinalizationHeight: 'field_finalizationHeight',
	fieldEpoch: 'field_epoch',
	eta: 'value_eta'
};

const fieldTitles = [SCREEN_TEXT.fieldChainHeight, SCREEN_TEXT.fieldFinalizationHeight, SCREEN_TEXT.fieldEpoch];

// Fixtures

const finalizedEpochInfo = {
	...finalizationInfo,
	epochProgress: 1,
	remainingBlocks: 0,
	epochEndEtaTimestamp: null
};

// Tests

const renderFinalization = async () => {
	render(<Finalization />);
	// Flush the mount fetch promise.
	await act(async () => {});
};

beforeAll(() => {
	jest.useFakeTimers();
});

describe('variants/symbol/components/Finalization', () => {
	afterEach(() => {
		jest.clearAllTimers();
	});

	describe('render scenarios', () => {
		const runRenderTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				fetchFinalizationInfo.mockReturnValue(config.response);

				// Act:
				await renderFinalization();

				// Assert:
				fieldTitles.forEach(title => expect(screen.getByText(title)).toBeInTheDocument());
				Object.entries(expected.textOccurrences).forEach(([text, count]) => expect(screen.getAllByText(text)).toHaveLength(count));
				expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', expected.progressValue);
				if (expected.etaText) {
					expect(screen.getByText(SCREEN_TEXT.eta, { exact: false })).toBeInTheDocument();
					expect(screen.getByText(expected.etaText, { exact: false })).toBeInTheDocument();
				} else {
					expect(screen.queryByText(SCREEN_TEXT.eta, { exact: false })).not.toBeInTheDocument();
				}
			});
		};

		const renderCases = [
			{
				description: 'renders placeholders while the first request is pending',
				config: { response: new Promise(() => {}) },
				expected: {
					textOccurrences: {
						'-': 4 // chainHeight, finalizationHeight, epochStart, epochEnd
					},
					progressValue: '0',
					etaText: null
				}
			},
			{
				description: 'renders the heights and the epoch progress with an ETA mid-epoch',
				config: { response: Promise.resolve(finalizationInfo) },
				expected: {
					textOccurrences: {
						6500: 1, // chainHeight
						6120: 1, // finalizationHeight
						9: 1, // epochStart
						10: 1 // epochEnd
					},
					progressValue: '50',
					etaText: 'value_remainingBlocks:360'
				}
			},
			{
				description: 'hides the ETA row when the epoch is fully finalized',
				config: { response: Promise.resolve(finalizedEpochInfo) },
				expected: {
					textOccurrences: {
						6500: 1, // chainHeight
						6120: 1 // finalizationHeight
					},
					progressValue: '100',
					etaText: null
				}
			},
			{
				description: 'keeps placeholders when Nodewatch has no data yet',
				config: { response: Promise.resolve(null) },
				expected: {
					textOccurrences: {
						'-': 4 // chainHeight, finalizationHeight, epochStart, epochEnd
					},
					progressValue: '0',
					etaText: null
				}
			}
		];

		renderCases.forEach(({ description, config, expected }) => runRenderTest(description, config, expected));
	});

	it('refreshes the finalization info on the refresh interval', async () => {
		// Arrange:
		const initialChainHeightText = '6500';
		const refreshedChainHeightText = '6620';
		const refreshedInfo = {
			...finalizedEpochInfo,
			chainHeight: 6620,
			finalizationHeight: 6480
		};
		fetchFinalizationInfo
			.mockResolvedValueOnce(finalizationInfo)
			.mockResolvedValueOnce(refreshedInfo);
		await renderFinalization();
		expect(screen.getByText(initialChainHeightText)).toBeInTheDocument();

		// Act: fire the polling interval and flush the refresh fetch promise.
		await act(async () => {
			jest.advanceTimersByTime(DATA_REFRESH_INTERVAL);
		});

		// Assert:
		expect(fetchFinalizationInfo).toHaveBeenCalledTimes(2);
		expect(screen.getByText(refreshedChainHeightText)).toBeInTheDocument();
		expect(screen.queryByText(initialChainHeightText)).not.toBeInTheDocument();
	});
});
