/* eslint-disable testing-library/no-node-access */
import Home from '.';
import * as styles from '../../../common/utils/styles';
import {
	render, screen, waitFor, act
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

		describe('background art', () => {
			const renderBgContainerWithResize = (height, width) => {
				// Arrange:
				window.ResizeObserver = jest.fn(callback => ({
					observe: jest.fn(),
					disconnect: jest.fn()
				}));

				render(<Home />);

				const artContainerRef = screen.getByTestId('art-container');

				// Act:
				act(() => {
					const resizeCallback = window.ResizeObserver.mock.calls[0][0];
					resizeCallback([{
						target: artContainerRef,
						contentRect: {
							height,
							width
						}
					}]);
				});
			};

			it('renders art when aspect ratio is less than 5', async () => {
				// Arrange + Act:
				renderBgContainerWithResize(100, 25);

				// Assert:
				const divBgImageLeft = screen.getByTestId('bg-image-left');
				const divBgImageRight = screen.getByTestId('bg-image-right');

				const divBgImageMobileLeft = screen.queryByTestId('bg-image-mobile-left');
				const divBgImageMobileRight = screen.queryByTestId('bg-image-mobile-right');

				expect(divBgImageLeft).toBeInTheDocument();
				expect(divBgImageRight).toBeInTheDocument();
				expect(divBgImageMobileLeft).not.toBeInTheDocument();
				expect(divBgImageMobileRight).not.toBeInTheDocument();
			});

			it('renders art in mobile when aspect ratio is between 5 and 15', async () => {
				// Arrange + Act:
				renderBgContainerWithResize(100, 10);

				// Assert:
				const divBgImageLeft = screen.queryByTestId('bg-image-left');
				const divBgImageRight = screen.queryByTestId('bg-image-right');

				const divBgImageMobileLeft = screen.getByTestId('bg-image-mobile-left');
				const divBgImageMobileRight = screen.getByTestId('bg-image-mobile-right');

				expect(divBgImageLeft).not.toBeInTheDocument();
				expect(divBgImageRight).not.toBeInTheDocument();
				expect(divBgImageMobileLeft).toBeInTheDocument();
				expect(divBgImageMobileRight).toBeInTheDocument();
			});

			it('renders nothing when aspect ratio is more than 15', async () => {
				// Arrange + Act:
				renderBgContainerWithResize(100, 6);

				// Assert:
				const divBgImageLeft = screen.queryByTestId('bg-image-left');
				const divBgImageRight = screen.queryByTestId('bg-image-right');

				const divBgImageMobileLeft = screen.queryByTestId('bg-image-mobile-left');
				const divBgImageMobileRight = screen.queryByTestId('bg-image-mobile-right');

				expect(divBgImageLeft).not.toBeInTheDocument();
				expect(divBgImageRight).not.toBeInTheDocument();
				expect(divBgImageMobileLeft).not.toBeInTheDocument();
				expect(divBgImageMobileRight).not.toBeInTheDocument();
			});
		});
	});
});
