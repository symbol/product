import '@testing-library/jest-dom';
import ValueTransactionMessage from '@/components/ValueTransactionMessage';
import { fireEvent, render, screen } from '@testing-library/react';

describe('ValueTransactionMessage', () => {
	it('renders the message icon and plain message popup content', () => {
		// Act:
		render(<ValueTransactionMessage message={{ type: 'plain', text: 'Hello Symbol' }} />);
		fireEvent.mouseEnter(screen.getByLabelText('Message'));

		// Assert:
		expect(screen.getByAltText('Message')).toHaveAttribute('src', '/images/transaction/message.svg');
		expect(screen.getByText('Plain message')).toBeInTheDocument();
		expect(screen.getByText('Hello Symbol')).toBeInTheDocument();
	});

	it('renders encrypted message type without message content', () => {
		// Act:
		render(<ValueTransactionMessage message={{ type: 'encrypted', text: 'secret payload' }} />);
		fireEvent.mouseEnter(screen.getByLabelText('Message'));

		// Assert:
		expect(screen.getByText('Encrypted message')).toBeInTheDocument();
		expect(screen.queryByText('secret payload')).not.toBeInTheDocument();
	});

	it('renders delegated harvesting persistent message content', () => {
		// Act:
		render(<ValueTransactionMessage message={{ type: 'delegatedHarvestingPersistent', text: 'FE2A8061577301E2AABBCC' }} />);
		fireEvent.mouseEnter(screen.getByLabelText('Message'));

		// Assert:
		expect(screen.getByText('Delegated Harvesting Persistent message')).toBeInTheDocument();
		expect(screen.getByText('FE2A8061577301E2AABBCC')).toBeInTheDocument();
	});

	it('renders raw message HEX content', () => {
		// Act:
		render(<ValueTransactionMessage message={{ type: 'raw', text: 'FF1234' }} />);
		fireEvent.mouseEnter(screen.getByLabelText('Message'));

		// Assert:
		expect(screen.getByText('Raw message')).toBeInTheDocument();
		expect(screen.getByText('FF1234')).toBeInTheDocument();
	});

	it('renders unsafe message content as text instead of HTML', () => {
		// Arrange:
		const unsafeText = '<img src=x onerror=alert(1)>';

		// Act:
		const { container } = render(<ValueTransactionMessage message={{ type: 'plain', text: unsafeText }} />);
		fireEvent.mouseEnter(screen.getByLabelText('Message'));

		// Assert:
		expect(screen.getByText(unsafeText)).toBeInTheDocument();
		expect(container.querySelector('img[src="x"]')).toBeNull();
		expect(document.body.querySelector('img[src="x"]')).toBeNull();
	});

	it('hides the popup when icon is no longer hovered', () => {
		// Arrange:
		render(<ValueTransactionMessage message={{ type: 'plain', text: 'Hello Symbol' }} />);
		const iconWrapper = screen.getByLabelText('Message');

		// Act:
		fireEvent.mouseEnter(iconWrapper);
		fireEvent.mouseLeave(iconWrapper);

		// Assert:
		expect(screen.queryByText('Hello Symbol')).not.toBeInTheDocument();
	});
});
