import AccountRenameModalBox from '.';
import testHelper from '../testHelper';
import { fireEvent, screen } from '@testing-library/react';

const context = {};

describe('components/AccountRenameModalBox', () => {
	it('renders the modal with current account name', () => {
		// Arrange
		testHelper.customRender(
			<AccountRenameModalBox
				isOpen={true}
				onRequestClose={jest.fn()}
				onRename={jest.fn()}
				currentName="Original Name"
				validateAccountName={jest.fn()}
			/>,
			context
		);

		// Act
		const input = screen.getByPlaceholderText('New Account Name');

		// Assert
		expect(input).toHaveValue('Original Name');
	});

	it('calls onRename when submitting a valid name', async () => {
		// Arrange
		const onRenameMock = jest.fn();
		const mockValidateAccountName = jest.fn().mockReturnValue('');
		const mockOnRequestClose = jest.fn();

		testHelper.customRender(
			<AccountRenameModalBox
				isOpen={true}
				onRequestClose={mockOnRequestClose}
				onRename={onRenameMock}
				currentName="Original Name"
				validateAccountName={mockValidateAccountName}
			/>,
			context
		);

		// Act
		const input = screen.getByPlaceholderText('New Account Name');
		fireEvent.change(input, { target: { value: 'New Name' } });

		const submitButton = screen.getByText('Submit');
		fireEvent.click(submitButton);

		// Assert
		expect(mockValidateAccountName).toHaveBeenCalledWith('New Name');
		expect(onRenameMock).toHaveBeenCalledWith('New Name');
		expect(mockOnRequestClose).toHaveBeenCalled();
	});

	it('displays error message for invalid name', () => {
		// Arrange
		const mockValidateAccountName = jest.fn().mockReturnValue('Invalid name');

		testHelper.customRender(
			<AccountRenameModalBox
				isOpen={true}
				onRequestClose={jest.fn()}
				onRename={jest.fn()}
				currentName="Original Name"
				validateAccountName={mockValidateAccountName}
			/>,
			context
		);

		// Act
		const input = screen.getByPlaceholderText('New Account Name');
		fireEvent.change(input, { target: { value: 'Invalid Name' } });

		const submitButton = screen.getByText('Submit');
		fireEvent.click(submitButton);

		// Assert
		const errorMessage = screen.getByText('Invalid name');
		expect(errorMessage).toBeInTheDocument();
	});

	it('closes modal when cancel button is clicked', () => {
		// Arrange
		const mockOnRequestClose = jest.fn();

		testHelper.customRender(
			<AccountRenameModalBox
				isOpen={true}
				onRequestClose={mockOnRequestClose}
				onRename={jest.fn()}
				currentName="Original Name"
				validateAccountName={jest.fn()}
			/>,
			context
		);

		// Act
		const cancelButton = screen.getByText('Cancel');
		fireEvent.click(cancelButton);

		// Assert
		expect(mockOnRequestClose).toHaveBeenCalled();
	});
});
