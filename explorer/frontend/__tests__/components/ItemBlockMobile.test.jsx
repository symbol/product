import '@testing-library/jest-dom';
import ItemBlockMobile from '@/components/ItemBlockMobile';
import { render, screen } from '@testing-library/react';

jest.mock('@/components/Avatar', () => {
	const AvatarMock = ({ value }) => <span>{value}</span>;

	return AvatarMock;
});

jest.mock('@/components/CustomImage', () => {
	const CustomImageMock = props => <span data-testid="block-finalization-icon" data-alt={props.alt} data-src={props.src} />;

	return CustomImageMock;
});

describe('ItemBlockMobile', () => {
	it('renders finalization icon when finalization is shown', () => {
		// Arrange:
		const data = {
			height: 1234,
			harvester: 'harvester-address',
			timestamp: '2026-01-01T00:00:00.000Z',
			totalFee: 1.25,
			transactionCount: 3,
			isFinalized: true,
			statementCount: 7,
			blockReward: 2.5
		};

		// Act:
		render(<ItemBlockMobile
			data={data}
			isFinalizationShown
			isStatementCountShown
			isBlockRewardShown
		/>);

		// Assert:
		const finalizationIcon = screen
			.getAllByTestId('block-finalization-icon')
			.find(element => 'Finalized block' === element.getAttribute('data-alt'));
		expect(finalizationIcon).toHaveAttribute('data-src', '/symbol/images/blocks/finalization-finalized.svg');
		expect(screen.getByText('table_field_statementCount')).toBeInTheDocument();
		expect(screen.getByText('table_field_blockReward')).toBeInTheDocument();
	});
});
