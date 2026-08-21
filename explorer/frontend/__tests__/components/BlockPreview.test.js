import '@testing-library/jest-dom';
import BlockPreview from '@/app/components/BlockPreview';
import { act, fireEvent, render, screen } from '@testing-library/react';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';

TimeAgo.addDefaultLocale(en);

jest.mock('next/router', () => ({
	useRouter: () => ({ locale: 'en' })
}));

beforeAll(() => {
	jest.useFakeTimers();
});

// next/image rewrites the src to an optimized URL with the original path URL-encoded; decode before asserting.
const getIconPath = image => decodeURIComponent(image.getAttribute('src'));

describe('components/BlockPreview', () => {
	// The component reveals the transaction squares 250ms after mount and clears the expanded style 300ms after collapsing.
	const TRANSACTION_SQUARES_DELAY = 250;
	const COLLAPSE_DELAY = 300;

	const block = {
		height: 4695085,
		timestamp: '2024-03-30 01:06:25',
		totalFee: 1.5,
		transactionCount: 3
	};
	const chainStatus = { height: 4696085 };
	const transactions = [{ hash: 'transaction-hash', fee: 0.5 }];

	const renderPreview = async (props = {}) => {
		let result;

		// Awaiting the render resolves the dynamic imports of the lazily loaded children.
		await act(async () => {
			result = render(<BlockPreview data={block} transactions={transactions} chainStatus={chainStatus} {...props} />);
		});

		return result;
	};

	describe('collapsed', () => {
		it('renders the block summary in a cube', async () => {
			// Act:
			await renderPreview();

			// Assert:
			expect(screen.getByText('4695085')).toBeInTheDocument();
			expect(screen.getByText('3 TXs.')).toBeInTheDocument();
			expect(screen.getByText('field_totalFee')).toBeInTheDocument();
			expect(screen.queryByText('field_height')).not.toBeInTheDocument();
		});

		const runChainIconTest = async (isNext, expectedIcon) => {
			// Act:
			await renderPreview({ isNext });

			// Assert:
			expect(getIconPath(screen.getByAltText('Chain icon'))).toContain(expectedIcon);
		};

		it('renders the confirmed chain icon for a harvested block', () => runChainIconTest(false, '/images/icon-chain.svg'));
		it('renders the pending chain icon for the next block', () => runChainIconTest(true, '/images/icon-chain-pending.svg'));

		it('selects the block on click', async () => {
			// Arrange:
			const onSelect = jest.fn();
			await renderPreview({ onSelect });

			// Act:
			fireEvent.click(screen.getByText('4695085'));

			// Assert:
			expect(onSelect).toHaveBeenCalledWith(block.height);
		});
	});

	describe('expanded', () => {
		it('renders the block details', async () => {
			// Act:
			await renderPreview({ isSelected: true });

			// Assert:
			expect(screen.getByText('field_height')).toBeInTheDocument();
			expect(screen.getByText('4695085')).toBeInTheDocument();
			expect(screen.getByText('field_status')).toBeInTheDocument();
			expect(screen.getByText('label_safe')).toBeInTheDocument();
			expect(screen.getByText('field_totalFee')).toBeInTheDocument();
			expect(screen.getByText('field_transactionFees')).toBeInTheDocument();
			expect(screen.queryByText('3 TXs.')).not.toBeInTheDocument();
		});

		it('links to the block page', async () => {
			// Act:
			await renderPreview({ isSelected: true });

			// Assert:
			expect(screen.getByAltText('More').closest('a')).toHaveAttribute('href', '/blocks/4695085');
		});

		it('does not re-select the block on click', async () => {
			// Arrange:
			const onSelect = jest.fn();
			await renderPreview({ isSelected: true, onSelect });

			// Act:
			fireEvent.click(screen.getByText('4695085'));

			// Assert:
			expect(onSelect).not.toHaveBeenCalled();
		});

		it('closes the details on close button click', async () => {
			// Arrange:
			const onClose = jest.fn();
			await renderPreview({ isSelected: true, onClose });

			// Act:
			fireEvent.click(screen.getByAltText('Close'));

			// Assert:
			expect(onClose).toHaveBeenCalled();
		});
	});

	describe('transaction squares', () => {
		it('delays the rendering of the transaction squares', async () => {
			// Act:
			await renderPreview({ isSelected: true });

			// Assert:
			expect(screen.queryByText('Mocked React ApexCharts')).not.toBeInTheDocument();
		});

		it('renders the transaction squares once the delay has passed', async () => {
			// Arrange:
			await renderPreview({ isSelected: true });

			// Act:
			await act(async () => {
				jest.advanceTimersByTime(TRANSACTION_SQUARES_DELAY);
			});

			// Assert:
			expect(screen.getByText('Mocked React ApexCharts')).toBeInTheDocument();
		});
	});

	describe('expanded style', () => {
		const expandedStyle = 'blockPreview_expanded';

		it('is applied while the block is selected', async () => {
			// Act:
			const { container } = await renderPreview({ isSelected: true });

			// Assert:
			expect(container.firstChild).toHaveClass(expandedStyle);
		});

		it('is removed once the collapse animation has finished', async () => {
			// Arrange:
			const { container, rerender } = await renderPreview({ isSelected: true });

			// Act:
			rerender(<BlockPreview data={block} transactions={transactions} chainStatus={chainStatus} isSelected={false} />);
			act(() => jest.advanceTimersByTime(COLLAPSE_DELAY));

			// Assert:
			expect(container.firstChild).not.toHaveClass(expandedStyle);
		});
	});
});
