import {
	getBreakpoint
} from './styles';
import breakpoints from '../config/breakpoints.json';

describe('utils/styles', () => {
	describe('getBreakpoint', () => {
		const runBasicBreakpointTests = (width, height, expectedResult) => {
			it(`returns ${expectedResult.className.replaceAll('-', ' ')} breakpoint by given height ${height} x width ${width}`, () => {
				// Arrange + Act:
				const result = getBreakpoint(width, height);

				// Assert:
				expect(result).toEqual(expectedResult);
			});
		}

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
				width: 813,
				height: 289
			},
			{
				width: 361,
				height: 541
			},
			{
				width: 361,
				height: 662
			},
			{
				width: 376,
				height: 569
			},
			{
				width: 376,
				height: 714
			},
			{
				width: 413,
				height: 634
			},
			{
				width: 413,
				height: 726
			},
			{
				width: 415,
				height: 638
			},
			{
				width: 415,
				height: 798
			},
			{
				width: 1281,
				height: 874
			},
			{
				width: 1361,
				height: 682
			},
			{
				width: 1369,
				height: 826
			},
			{
				width: 1440,
				height: 814
			},
			{
				width: 1538,
				height: 777
			},
			{
				width: 1601,
				height: 814
			},
			{
				width: 1601,
				height: 950
			},
			{
				width: 1601,
				height: 1200
			},
			{
				width: 1685,
				height: 970
			},
			{
				width: 1910,
				height: 1149
			},
			{
				width: 1950,
				height: 200
			},
			{
				width: 1950,
				height: 1390
			},
			{
				width: 1950,
				height: 1500
			},
			{
				width: 2100,
				height: 1200
			},
			{
				width: 2570,
				height: 1000
			},
			{
				width: 2570,
				height: 1353
			},
			{
				width: 2570,
				height: 1512
			},
			{
				width: 2570,
				height: 1850
			},
			{
				width: 3500,
				height: 1850
			},
			{
				width: 3850,
				height: 1850
			},
			{
				width: 3850,
				height: 2100
			},
			{
				width: 3850,
				height: 2400
			},
			{
				width: 3850,
				height: 2800
			},
			{
				width: 3850,
				height: 3000
			},
			{
				width: 6060,
				height: 3300
			},
		]

		screenSize.forEach(({width, height}, index) => {
			runBasicBreakpointTests(width, height, breakpoints[index])
		});
	});
});
