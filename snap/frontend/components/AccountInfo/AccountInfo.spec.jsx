import AccountInfo from '.';
import testHelper from '../testHelper';
import { screen } from '@testing-library/react';

const context = {
	dispatch: jest.fn(),
	walletState: {
		selectedAccount: {
			address: 'address 1',
			label: 'wallet 1'
		}
	}
};

describe('components/AccountInfo', () => {
	it('renders profile image', () => {
		// Arrange:
		testHelper.customRender(<AccountInfo />, context);

		// Act:
		const image = screen.getByRole('profile-image');

		// Assert:
		expect(image).toBeInTheDocument();
	});

	it('renders address and wallet label', () => {
		// Arrange:
		testHelper.customRender(<AccountInfo />, context);

		// Act:
		const address = screen.getByText('address 1');
		const label = screen.getByText('wallet 1');
		const copyIcon = screen.getByAltText('Copy logo');

		// Assert:
		expect(address).toBeInTheDocument();
		expect(label).toBeInTheDocument();
		expect(copyIcon).toBeInTheDocument();
	});
});