import '@testing-library/jest-dom';
import ValueRewardType from '@/app/components/ValueRewardType';
import { REWARD_TYPE } from '@/app/constants';
import { render, screen } from '@testing-library/react';

describe('ValueRewardType', () => {
	it('renders the translated reward type', () => {
		// Arrange:
		const expectedText = 'rewardType_harvesting';

		// Act:
		render(<ValueRewardType value={REWARD_TYPE.HARVESTING} />);

		// Assert:
		expect(screen.getByText(expectedText)).toBeInTheDocument();
	});
});
