/* eslint-disable testing-library/no-node-access */
import Home from '.';
import * as styles from '../../../common/utils/styles';
import {
	render, screen, waitFor
} from '@testing-library/react';

const mockResizeObserverAndGetBreakpoint = (isPortrait, breakpointClassName) => {
	jest.spyOn(styles, 'getBreakpoint').mockImplementation(() => ({
		className: breakpointClassName,
		portrait: isPortrait
	}));
	window.ResizeObserver = jest.fn().mockImplementation(resize => {
		resize([{
			target: document.documentElement,
			contentRect: {}
		}]);

		return {
			observe: jest.fn()
		};
	});
};

describe('page/Home', () => {
	describe('screen breakpoint', () => {
		const runBasicResizeBreakpointTests = (isPortrait, className, expectedResult) => {
			it(`renders page in ${isPortrait ? 'portrait' : 'landscape' } orientation
				with the class name when portrait boolean is ${isPortrait}`, async () => {
				// Arrange:
				mockResizeObserverAndGetBreakpoint(isPortrait, className);

				// Act:
				render(<Home />);

				// Assert:
				await waitFor(() => expect(screen.getByTestId('home-page-content').classList).toContain(expectedResult));
				expect(document.documentElement.classList).toContain(className);
			});
		};

		runBasicResizeBreakpointTests(true, 'breakpoint-class-1', 'page-container-portrait');
		runBasicResizeBreakpointTests(false, 'breakpoint-class-2', 'page-container-landscape');
	});
});
