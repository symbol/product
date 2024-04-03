import ConnectMetamask from '.';
import * as WalletContext from '../../context/store';
import symbolSnap from '../../utils/snap';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const context = {
	dispatch: jest.fn()
};

describe('components/ConnectMetamask', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	const customRender = ui => render(<WalletContext.default value={context}>
		{ui}
	</WalletContext.default>);

	it('renders title, description and children with isOpen is true', async () => {
		// Arrange:
		const title = 'Connect to MetaMask Symbol Snap';
		const description = 'If you do not have the Symbol snap installed you will be prompted to install it.';
		const children = 'Connect MetaMask';

		// Act:
		customRender(<ConnectMetamask isOpen={true} onRequestClose={() => { }} />);

		// Assert:
		const titleElement = screen.getByText(title);
		const descriptionElement = screen.getByText(description);
		const childrenElement = screen.getByText(children);

		expect(titleElement).toBeInTheDocument();
		expect(descriptionElement).toBeInTheDocument();
		expect(childrenElement).toBeInTheDocument();
	});

	it('does not render when isOpen is false', () => {
		// Arrange + Act:
		customRender(<ConnectMetamask isOpen={false} />);

		// Assert:
		const modalElement = screen.queryByRole('modal');

		expect(modalElement).not.toBeInTheDocument();
	});

	describe('onRequestClose', () => {
		describe('mousedown', () => {
			it('does not called when clicked in modal box', () => {
				// Arrange:
				const onRequestClose = jest.fn();
				customRender(<ConnectMetamask isOpen={true} onRequestClose={onRequestClose} />);
				const element = screen.getByRole('modal');

				// Act:
				fireEvent.click(element);

				// Assert:
				expect(onRequestClose).not.toHaveBeenCalled();
			});

			it('called when overlay is clicked', () => {
				// Arrange:
				const onRequestClose = jest.fn();
				customRender(<ConnectMetamask isOpen={true} onRequestClose={onRequestClose} />);
				const element = screen.getByRole('overlay');

				// Act:
				fireEvent.mouseDown(element);

				// Assert:
				expect(onRequestClose).toHaveBeenCalled();
			});
		});
	});

	describe('handleConnectClick', () => {
		const assertSnapIsConnected = async (isConnected, expectedResult) => {
			// Arrange:
			jest.spyOn(symbolSnap(), 'connectSnap').mockResolvedValue(isConnected);
			customRender(<ConnectMetamask isOpen={true} onRequestClose={() => { }} />);
			const element = screen.getByText('Connect MetaMask');

			// Act:
			fireEvent.click(element);

			// Assert:
			await waitFor(() => expect(context.dispatch).toHaveBeenCalledWith({ type: 'setSnapInstalled', payload: expectedResult }));
		};

		it('dispatch setSnapInstalled true when connected', async () => {
			assertSnapIsConnected(true, true);
		});

		it('dispatch setSnapInstalled false when connect snap throw error', async () => {
			assertSnapIsConnected(false, false);
		});
	});
});
