// Checks datetime strings without a timezone, that browsers parse in local time.
// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format
const LOCAL_DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

const LOCAL_GETTER_NAMES = [
	'getFullYear',
	'getMonth',
	'getDate',
	'getDay',
	'getHours',
	'getMinutes',
	'getSeconds',
	'getMilliseconds'
];

/**
 * Makes `Date` behave as in a browser running with the given fixed UTC offset: timezone-less strings are parsed
 * in local time, local getters return local time and `getTimezoneOffset` returns the offset.
 * Constructors taking date components are not shifted.
 * @param {number} offsetMinutes - Offset as returned by `getTimezoneOffset` (e.g. 300 for UTC-5, -540 for UTC+9).
 * @returns {Function} Restores the `Date` that was global before the call.
 */
export const mockUserTimezone = offsetMinutes => {
	const OriginalDate = global.Date;
	const machineOffsetMinutes = new OriginalDate().getTimezoneOffset();
	const parseShiftMilliseconds = (offsetMinutes - machineOffsetMinutes) * 60000;

	class TimezoneMockDate extends OriginalDate {
		constructor(...args) {
			if (1 === args.length && 'string' === typeof args[0] && LOCAL_DATE_TIME_REGEX.test(args[0]))
				super(new OriginalDate(args[0]).getTime() + parseShiftMilliseconds);
			else
				super(...args);
		}

		getTimezoneOffset() {
			return offsetMinutes;
		}
	}

	LOCAL_GETTER_NAMES.forEach(name => {
		const utcGetterName = name.replace('get', 'getUTC');
		TimezoneMockDate.prototype[name] = function () {
			return new OriginalDate(this.getTime() - (offsetMinutes * 60000))[utcGetterName]();
		};
	});

	global.Date = TimezoneMockDate;

	return () => {
		global.Date = OriginalDate;
	};
};
