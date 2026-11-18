import '@testing-library/jest-dom';
import { mockUserTimezone } from '../test-utils/timezone';
import ValueAge from '@/app/components/ValueAge';
import { render, screen } from '@testing-library/react';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';

// Constants

const timezoneOffsetMinutes = {
	'UTC': 0,
	'UTC+9': -540,
	'UTC-4': 240
};

// Mocks

jest.mock('next/router', () => ({
	useRouter: () => ({ locale: 'en' })
}));

TimeAgo.addDefaultLocale(en);

// Tests

beforeAll(() => {
	// "Now" is pinned, so every case value is exactly three hours away from it.
	jest.useFakeTimers({ now: new Date('2026-06-16T12:00:00.000Z') });
});

describe('components/ValueAge', () => {
	let restoreTimezone;

	afterEach(() => {
		restoreTimezone();
	});

	describe('render scenarios', () => {
		const runRenderTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				restoreTimezone = mockUserTimezone(timezoneOffsetMinutes[config.timezone]);

				// Act:
				render(<ValueAge value={config.value} />);

				// Assert:
				expect(await screen.findByText(expected.text)).toBeInTheDocument();
			});
		};

		const renderCases = [
			{
				description: 'renders a future Date object by its absolute time in UTC',
				config: {
					timezone: 'UTC',
					value: new Date('2026-06-16T15:00:00Z')
				},
				expected: { text: 'in 3 hours' }
			},
			{
				description: 'renders a future Date object by its absolute time in UTC+9',
				config: {
					timezone: 'UTC+9',
					value: new Date('2026-06-16T15:00:00Z')
				},
				expected: { text: 'in 3 hours' }
			},
			{
				description: 'renders a future Date object by its absolute time in UTC-4',
				config: {
					timezone: 'UTC-4',
					value: new Date('2026-06-16T15:00:00Z')
				},
				expected: { text: 'in 3 hours' }
			},
			{
				description: 'renders a timezone-less string as UTC time in UTC+9',
				config: {
					timezone: 'UTC+9',
					value: '2026-06-16 15:00:00'
				},
				expected: { text: 'in 3 hours' }
			},
			{
				description: 'renders a timezone-less string as UTC time in UTC',
				config: {
					timezone: 'UTC',
					value: '2026-06-16 15:00:00'
				},
				expected: { text: 'in 3 hours' }
			},
			{
				description: 'renders a timezone-less string as UTC time in UTC-4',
				config: {
					timezone: 'UTC-4',
					value: '2026-06-16 15:00:00'
				},
				expected: { text: 'in 3 hours' }
			},
			{
				description: 'renders a string with the Z designator by its absolute time in UTC+9',
				config: {
					timezone: 'UTC+9',
					value: '2026-06-16T15:00:00Z'
				},
				expected: { text: 'in 3 hours' }
			},
			{
				description: 'renders a string with an offset designator by its absolute time in UTC+9',
				config: {
					timezone: 'UTC+9',
					value: '2026-06-17T00:00:00+09:00'
				},
				expected: { text: 'in 3 hours' }
			},
			{
				description: 'renders a past Date object as an age in UTC+9',
				config: {
					timezone: 'UTC+9',
					value: new Date('2026-06-16T09:00:00Z')
				},
				expected: { text: '3 hours ago' }
			},
			{
				description: 'renders a past timezone-less string as an age in UTC+9',
				config: {
					timezone: 'UTC+9',
					value: '2026-06-16 09:00:00'
				},
				expected: { text: '3 hours ago' }
			}
		];

		renderCases.forEach(({ description, config, expected }) => runRenderTest(description, config, expected));
	});
});
