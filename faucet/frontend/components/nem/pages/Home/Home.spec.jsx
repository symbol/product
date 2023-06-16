import Home from '.';
import { jest } from '@jest/globals';
import {
	render, screen, waitFor
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
	});

	describe('configuration', () => {
		it('requests config endpoint when init component', async () => {
			// Act:
			render(<Home />);

			// Assert:
			await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/config/xem'));
		});
	});
});
