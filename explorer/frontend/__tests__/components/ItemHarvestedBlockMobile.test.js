import '@testing-library/jest-dom';
import ItemHarvestedBlockMobile from '@/app/components/ItemHarvestedBlockMobile';
import { render, screen } from '@testing-library/react';

const harvestedBlock = {
	height: 1000,
	timestamp: '2024-03-30 01:06:25',
	amount: 0.25
};

describe('ItemHarvestedBlockMobile', () => {
	it('links the height to the block page', () => {
		// Act:
		render(<ItemHarvestedBlockMobile data={harvestedBlock} />);

		// Assert:
		expect(screen.getByText('1000').closest('a')).toHaveAttribute('href', '/blocks/1000');
	});

	it('renders the harvested amount', () => {
		// Act:
		render(<ItemHarvestedBlockMobile data={harvestedBlock} />);

		// Assert:
		expect(screen.getByTitle('0.25 XEM')).toBeInTheDocument();
	});
});
