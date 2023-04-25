import reportWebVitals from './reportWebVitals';
import * as webVitals from 'web-vitals';
import { waitFor } from '@testing-library/react';

jest.mock('web-vitals', () => ({
	getCLS: jest.fn(),
	getFID: jest.fn(),
	getFCP: jest.fn(),
	getLCP: jest.fn(),
	getTTFB: jest.fn(),
}));

describe('reportWebVitals', () => {
	test('calls onPerfEntry for each web vital when onPerfEntry is a function', async () => {
		// Arrange:
		const onPerfEntry = () => jest.fn();

		// Act:
		reportWebVitals(onPerfEntry);

		// Assert:
		await waitFor(() => {
			expect(webVitals.getCLS).toHaveBeenCalledWith(onPerfEntry)
			expect(webVitals.getFID).toHaveBeenCalledWith(onPerfEntry);
			expect(webVitals.getFCP).toHaveBeenCalledWith(onPerfEntry);
			expect(webVitals.getLCP).toHaveBeenCalledWith(onPerfEntry);
			expect(webVitals.getTTFB).toHaveBeenCalledWith(onPerfEntry);
		});
	});

	test('does not call onPerfEntry when onPerfEntry is not a function', async () => {
		// Arrange + Act:
		reportWebVitals('not a function');

		// Assert:
		expect(webVitals.getCLS).not.toHaveBeenCalled();
		expect(webVitals.getFID).not.toHaveBeenCalled();
		expect(webVitals.getFCP).not.toHaveBeenCalled();
		expect(webVitals.getLCP).not.toHaveBeenCalled();
		expect(webVitals.getTTFB).not.toHaveBeenCalled();
	});
})
