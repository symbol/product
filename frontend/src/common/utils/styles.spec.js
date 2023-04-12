import {
	getBreakpoint
} from './styles';
const breakpoints = [
	{
		'width': 0,
		'height': 0,
		'portrait': true,
		'className': 'portrait-mobile-short-xs'
	},
	{
		'width': 567,
		'height': 233,
		'portrait': false,
		'className': 'landscape-mobile-short'
	},
	{
		'width': 6016,
		'height': 3293,
		'portrait': true,
		'className': 'portrait-large-xl'
	}
];


describe('utils/styles', () => {
	describe('getBreakpoint', () => {
		const runBasicBreakpointTests = (width, height, expectedResult) => {
			it(`returns "${expectedResult.className}" breakpoint by given height ${height} x width ${width}`, () => {
				// Arrange + Act:
				const result = getBreakpoint(width, height, breakpoints);

				// Assert:
				expect(result).toEqual(expectedResult);
			});
		};

		// Arrange:
		const screenSize = [
			{
				width: 240,
				height: 736
			},
			{
				width: 736,
				height: 240
			},
			{
				width: 6060,
				height: 3300
			}
		];

		screenSize.forEach(({width, height}, index) => {
			runBasicBreakpointTests(width, height, breakpoints[index]);
		});
	});
});
