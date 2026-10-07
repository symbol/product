import '@testing-library/jest-dom';
import ValueAge from '@/app/components/ValueAge';
import { render, screen } from '@testing-library/react';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';

// Constants

// Checks datetime strings without a timezone, that browsers parse in local time.
// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format
const LOCAL_DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

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

let FakeTimersDate;

// Makes date parsing and the timezone offset behave as in a browser running with the given UTC offset.
const mockUserTimezone = offsetMinutes => {
	const machineOffsetMinutes = new FakeTimersDate().getTimezoneOffset();
	const parseShiftMilliseconds = (offsetMinutes - machineOffsetMinutes) * 60000;

	class TimezoneMockDate extends FakeTimersDate {
		constructor(...args) {
			if (args.length === 1 && typeof args[0] === 'string' && LOCAL_DATE_TIME_REGEX.test(args[0]))
				super(new FakeTimersDate(args[0]).getTime() + parseShiftMilliseconds);
			else
				super(...args);
		}

		getTimezoneOffset() {
			return offsetMinutes;
		}
	}

	global.Date = TimezoneMockDate;
};

// Tests

beforeAll(() => {
	// "Now" is pinned, so every case value is exactly three hours away from it.
	jest.useFakeTimers({ now: new Date('2026-06-16T12:00:00.000Z') });
	FakeTimersDate = global.Date;
});

describe('components/ValueAge', () => {
	afterEach(() => {
		global.Date = FakeTimersDate;
	});

	describe('render scenarios', () => {
		const runRenderTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockUserTimezone(timezoneOffsetMinutes[config.timezone]);

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
