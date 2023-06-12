import Home from '.';
import { jest } from '@jest/globals';
import {
	act, render, screen, waitFor
} from '@testing-library/react';
import axios from 'axios';

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

	beforeEach(() => {
		jest.spyOn(axios, 'create').mockReturnValue({
			get: (url, ...params) => axios.get(url, ...params),
			defaults: {}
		});

		jest.spyOn(axios, 'get').mockReturnValue({
			data: {
				faucetAddress: 'Faucet_address',
				currency: 'TOKEN',
				sendOutMaxAmount: 0,
				mosaicDivisibility: 6,
				minFollowers: 10,
				minAccountAge: 30,
				faucetBalance: 100000000
			}
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

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

		describe('background art', () => {
			const renderBgContainerWithResize = async (height, width) => {
				// Arrange:
				window.ResizeObserver = jest.fn(callback => ({
					observe: jest.fn(),
					disconnect: jest.fn()
				}));

				await waitFor(() => {
					render(<Home />);
				});

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
				await renderBgContainerWithResize(100, 25);

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
				await renderBgContainerWithResize(100, 10);

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
				await renderBgContainerWithResize(100, 6);

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

	describe('configuration', () => {
		it('requests config endpoint when init component', async () => {
			// Act:
			await waitFor(() => {
				render(<Home />);
			});

			// Assert:
			expect(axios.get).toHaveBeenCalledWith('/config/xym');
		});
	});
});
