import AccountCreationFormModalBox from '.';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

describe('components/AccountCreationFormModalBox', () => {
	// Arrange:
	const mockOnSubmit = jest.fn();
	const mockOnRequestClose = jest.fn();
	const inputs = [
		{
			label: 'Account Name:',
			placeholder: 'name',
			field: 'accountName',
			value: '',
			validate: value => value ? null : 'Required'
		},
		{
			label: 'Password:',
			placeholder: 'password',
			field: 'password',
			value: '',
			validate: value => 8 <= value.length ? null : 'Must be at least 8 characters'
		}
	];

	const renderComponent = () =>
		render(<AccountCreationFormModalBox
			isOpen={true}
			onRequestClose={mockOnRequestClose}
			title='Create Account'
			onSubmit={mockOnSubmit}
			inputs={inputs}
		/>);

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('renders form with given title and inputs', () => {
		// Act:
		renderComponent();

		// Assert:
		const formTitle = screen.getByText('Create Account');
		const accountNameInput = screen.getByPlaceholderText('name');
		const passwordInput = screen.getByPlaceholderText('password');

		expect(formTitle).toBeInTheDocument();
		expect(accountNameInput).toBeInTheDocument();
		expect(passwordInput).toBeInTheDocument();
	});

	const assertSubmitButton = async (name, password, expectedResult) => {
		// Arrange:
		renderComponent();

		const accountNameInput = screen.getByPlaceholderText('name');
		const passwordInput = screen.getByPlaceholderText('password');
		const submitButton = screen.getByText('Submit');

		fireEvent.change(accountNameInput, { target: { value: name } });
		fireEvent.change(passwordInput, { target: { value: password } });

		// Act:
		await waitFor(() => fireEvent.click(submitButton));

		// Assert:
		if (expectedResult) {
			expect(mockOnSubmit).toHaveBeenCalledWith({ accountName: name, password });
			expect(mockOnRequestClose).toHaveBeenCalledWith(false);
		} else {
			expect(mockOnSubmit).not.toHaveBeenCalled();
		}
	};

	it('submits form with valid data when submit button is clicked', async () => {
		await assertSubmitButton('name', 'password', true);
	});

	it('does not submit form with invalid data when submit button is clicked', async () => {
		assertSubmitButton('', 'password', false);
	});
});
