import FeeMultiplier from '.';
import testHelper from '../testHelper';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

const context = {
	symbolSnap: {
		getFeeMultiplier: jest.fn()
	}
};

describe('components/FeeMultiplier', () => {
	let mockSetSelectedFeeMultiplier;
	let mockSelectedFeeMultiplier;

	beforeEach(() => {
		jest.clearAllMocks();

		context.symbolSnap.getFeeMultiplier.mockResolvedValue({
			slow: 10,
			average: 100,
			fast: 1000
		});

		mockSetSelectedFeeMultiplier = jest.fn();
		mockSelectedFeeMultiplier = { key: 'slow', value: 10 };
	});
	it('renders FeeMultiplier', async () => {
		// Act:
		testHelper.customRender(<FeeMultiplier
			selectedFeeMultiplier={mockSelectedFeeMultiplier}
			setSelectedFeeMultiplier={mockSetSelectedFeeMultiplier} />, context);

		// Assert:
		await waitFor(() => {
			expect(screen.getByText('SLOW')).toBeInTheDocument();
			expect(screen.getByText('AVERAGE')).toBeInTheDocument();
			expect(screen.getByText('FAST')).toBeInTheDocument();
			expect(mockSetSelectedFeeMultiplier).toHaveBeenCalledWith(mockSelectedFeeMultiplier);
		});
	});

	it('update selected fee multiplier (key)', async () => {
		// Arrange:
		testHelper.customRender(<FeeMultiplier
			selectedFeeMultiplier={mockSelectedFeeMultiplier}
			setSelectedFeeMultiplier={mockSetSelectedFeeMultiplier} />, context);

		// Act:
		await waitFor(() => fireEvent.click(screen.getByText('FAST')));

		// Assert:
		expect(mockSetSelectedFeeMultiplier).toHaveBeenCalledWith({
			key: 'fast',
			value: 1000
		});
	});
});
