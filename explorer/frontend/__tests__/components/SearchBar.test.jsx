import '@testing-library/jest-dom';
import SearchBar from '@/app/components/SearchBar';
import { act, fireEvent, render, screen } from '@testing-library/react';

describe('SearchBar', () => {
	beforeAll(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.clearAllTimers();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	const enterSearch = async onSearchRequest => {
		// Arrange:
		render(<SearchBar onSearchRequest={onSearchRequest} />);
		const input = screen.getByPlaceholderText('field_search');

		// Act:
		fireEvent.change(input, { target: { value: ' 123 ' } });
		act(() => {
			jest.advanceTimersByTime(750);
			jest.runOnlyPendingTimers();
		});

		return input;
	};

	it('shows a successful block result and closes after selecting it', async () => {
		// Arrange:
		let resolveSearch;
		const onSearchRequest = jest.fn(() => new Promise(resolve => {
			resolveSearch = resolve;
		}));

		// Act:
		const input = await enterSearch(onSearchRequest);

		// Assert:
		expect(onSearchRequest).toHaveBeenCalledTimes(1);
		expect(onSearchRequest).toHaveBeenCalledWith('123');
		expect(screen.getByRole('status')).toBeInTheDocument();

		await act(async () => {
			resolveSearch({ block: { height: 123, timestamp: '123456789' } });
			await Promise.resolve();
			await Promise.resolve();
		});

		const result = screen.getByText('123');
		expect(result.closest('a')).toHaveAttribute('href', '/blocks/123');

		fireEvent.click(result);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(input).toHaveValue('');
	});

	it.each([
		['returns no-result state for an empty response', {}],
		['returns no-result state after a failed request', new Error('request failed')]
	])('%s', async (_title, response) => {
		// Arrange:
		const onSearchRequest = jest.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));

		// Act:
		await enterSearch(onSearchRequest);
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		// Assert:
		expect(onSearchRequest).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
		expect(screen.getByText('message_nothingFound')).toBeInTheDocument();
	});
});
