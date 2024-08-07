import FeeMultiplier from '.';
import testHelper from '../testHelper';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

const context = {
	symbolSnap: {
		getFeeMultiplier: jest.fn()
	}
};

describe('components/FeeMultiplier', () => {
	it('renders FeeMultiplier', async () => {
		// Arrange:
		context.symbolSnap.getFeeMultiplier.mockResolvedValue({
			slow: 10,
			average: 100,
			fast: 1000
		});

		// Act:
		await act(async () => await testHelper.customRender(<FeeMultiplier />, context));

		// Assert:
		await waitFor(() => {
			expect(screen.getByText('SLOW')).toBeInTheDocument();
			expect(screen.getByText('AVERAGE')).toBeInTheDocument();
			expect(screen.getByText('FAST')).toBeInTheDocument();
		});
	});

	it('update selected fee multiplier (key)', async () => {
		// Arrange:
		context.symbolSnap.getFeeMultiplier.mockResolvedValue({
			slow: 10,
			average: 100,
			fast: 1000
		});

		const mockSetSelectedFeeMultiplier = jest.fn();

		await act(async () =>
			await testHelper.customRender(<FeeMultiplier setSelectedFeeMultiplier={mockSetSelectedFeeMultiplier} />, context));

		// Act:
		await waitFor(() => fireEvent.click(screen.getByText('SLOW')));

		// Assert:
		expect(mockSetSelectedFeeMultiplier).toHaveBeenCalledWith('slow');
	});
});
