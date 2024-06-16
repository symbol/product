import Address from '.';
import testHelper from '../testHelper';
import { act, fireEvent, screen } from '@testing-library/react';

const context = {
	dispatch: jest.fn(),
	walletState: {
		selectedAccount: {
			id: '1234',
			addressIndex: 1,
			type: 'metamask',
			networkName: 'testnet',
			label: 'Wallet 1',
			address: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y',
			publicKey: 'FABAD1271A72816961B95CCCAAE1FD1E356F26A6AD3E0A91A25F703C1312F73D'
		}
	}
};

describe('components/Address', () => {
	it('renders address, wallet label and copy button', () => {
		// Arrange:
		testHelper.customRender(<Address account={context.walletState.selectedAccount} />, context);

		// Act:
		const address = screen.getByText(context.walletState.selectedAccount.address);
		const label = screen.getByText(context.walletState.selectedAccount.label);
		const copyIcon = screen.getByAltText('Copy logo');

		// Assert:
		expect(address).toBeInTheDocument();
		expect(label).toBeInTheDocument();
		expect(copyIcon).toBeInTheDocument();
	});

	it('renders copied to clipboard message when the copy icon is clicked', async () => {
		// Arrange:
		Object.assign(navigator, {
			clipboard: {
				writeText: jest.fn()
			}
		});

		testHelper.customRender(<Address account={context.walletState.selectedAccount} />, context);

		// Act:
		const copyIcon = screen.getByAltText('Copy logo');
		await act(async () => fireEvent.click(copyIcon));

		// Assert:
		const copiedMessage = screen.getByText('Copied to clipboard!');
		expect(copiedMessage).toBeInTheDocument();
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(context.walletState.selectedAccount.address);
	});
});
