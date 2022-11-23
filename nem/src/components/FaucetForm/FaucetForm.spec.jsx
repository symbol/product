/* eslint-disable testing-library/no-node-access */
import FaucetForm from '.';
import * as i18n from '../../i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

beforeEach(() => {
	jest.spyOn(i18n, '$t').mockImplementation(key => `translated_${key}`);
});

describe('components/FaucetForm', () => {
	const addressFirstChar = 'T';
	const currency = 'XEM';
	const maxAmount = 10_000;

	it('should fire onSubmit event', () => {
		// Arrange:
		const callback = jest.fn();

		// Act:
		render(<FaucetForm
			addressFirstChar={addressFirstChar}
			currency={currency}
			maxAmount={maxAmount}
			onSubmit={callback}
		/>);
		const element = screen.getByText('translated_home_form_button_claim_text');
		fireEvent.click(element);

		// Assert:
		expect(callback).toHaveBeenCalledWith('', '');
	});

	it('should fire onSubmit event with entered values', () => {
		// Arrange:
		const callback = jest.fn();
		const recipientAddress = 'TAZJ3KEPYAQ4G4Y6Q2IRZTQPU7RAKGYZULZURKTO';
		const amount = '500';

		// Act:
		render(<FaucetForm
			recipientAddress={recipientAddress}
			addressFirstChar={addressFirstChar}
			currency={currency}
			maxAmount={maxAmount}
			onSubmit={callback}
		/>);
		const elementAmount = screen.getByPlaceholderText('translated_home_form_input_amount_placeholder');
		const elementButton = screen.getByText('translated_home_form_button_claim_text');
		userEvent.type(elementAmount, amount);
		fireEvent.click(elementButton);

		// Assert:
		expect(callback).toHaveBeenCalledWith(recipientAddress, amount);
	});

	it('should render auth form', () => {
		// Arrange:
		const onSubmitCallback = jest.fn();
		const onAuthRequestCallback = jest.fn();
		const showAuth = true;

		// Act:
		render(<FaucetForm
			showAuth={showAuth}
			addressFirstChar={addressFirstChar}
			currency={currency}
			maxAmount={maxAmount}
			onSubmit={onSubmitCallback}
			onAuthRequest={onAuthRequestCallback}
		/>);
		const element = screen.getByText('translated_home_form_auth_description');

		// Assert:
		expect(element).toBeInTheDocument();
	});

	it('should fire onAuthRequest event', () => {
		// Arrange:
		const onSubmitCallback = jest.fn();
		const onAuthRequestCallback = jest.fn();
		const showAuth = true;

		// Act:
		render(<FaucetForm
			showAuth={showAuth}
			addressFirstChar={addressFirstChar}
			currency={currency}
			maxAmount={maxAmount}
			onSubmit={onSubmitCallback}
			onAuthRequest={onAuthRequestCallback}
		/>);
		const element = screen.getByText('translated_home_form_button_auth_twitter');
		fireEvent.click(element);

		// Assert:
		expect(onAuthRequestCallback).toHaveBeenCalled();
	});
});
