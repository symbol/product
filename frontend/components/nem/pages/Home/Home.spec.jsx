import Home from '.';
import { jest } from '@jest/globals';
import {
	render, screen, waitFor
} from '@testing-library/react';

describe('page/Home', () => {
	const mockResizeObserverAndGetBreakpoint = ({width, height}) => {
		window.ResizeObserver = jest.fn().mockImplementation(resize => {
			resize([{
				target: document.documentElement,
				contentRect: {
					height,
					width
				}
			}]);

			return {
				observe: jest.fn()
			};
		});
	};

	describe('screen breakpoint', () => {
		const runBasicResizeBreakpointTests = (screenSize, expectedResult) => {
			it(`renders page in height: ${screenSize.height} and width: ${screenSize.width}`, async () => {
				// Arrange:
				mockResizeObserverAndGetBreakpoint({...screenSize});

				// Act:
				render(<Home />);

				// Assert:
				await waitFor(() => expect(screen.getByTestId('home-page-content').classList).toContain(expectedResult.pageContainer));
				expect(document.documentElement.classList).toContain(expectedResult.className);
			});
		};

		// screen size follow config/breakpoints.json
		describe('landscape', () => {
			runBasicResizeBreakpointTests({
				width: 567,
				height: 233
			}, {
				className: 'landscape-mobile-short',
				pageContainer: 'page-container-landscape'
			});
		});

		describe('portrait', () => {
			runBasicResizeBreakpointTests({
				width: 375,
				height: 568
			}, {
				className: 'portrait-mobile-short',
				pageContainer: 'page-container-portrait'
			});
		});
	});
});
