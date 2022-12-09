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
	const setAuthStatusCallback = jest.fn();

	const createSignInStatus = isSignIn => ({
		isSignIn,
		screenName: 'twitterAccount'
	});

	it('should fire onSubmit event', () => {
		// Arrange:
		const callback = jest.fn();
		const accountSignIn = createSignInStatus(true);

		// Act:
		render(<FaucetForm
			addressFirstChar={addressFirstChar}
			currency={currency}
			maxAmount={maxAmount}
			onSubmit={callback}
			onAuthStatus={accountSignIn}
			setAuthStatus={setAuthStatusCallback}
		/>);
		const element = screen.getByText('translated_home_form_button_claim_text');
		const elementTwitterAuthButton = screen.queryByText('translated_home_form_button_auth_twitter');
		fireEvent.click(element);

		// Assert:
		expect(callback).toHaveBeenCalledWith('', '');
		expect(elementTwitterAuthButton).not.toBeInTheDocument();

	});

	it('should fire onSubmit event with entered values', () => {
		// Arrange:
		const callback = jest.fn();
		const recipientAddress = 'TAZJ3KEPYAQ4G4Y6Q2IRZTQPU7RAKGYZULZURKTO';
		const amount = '500';
		const accountSignIn = createSignInStatus(true);

		// Act:
		render(<FaucetForm
			addressFirstChar={addressFirstChar}
			currency={currency}
			maxAmount={maxAmount}
			onSubmit={callback}
			onAuthStatus={accountSignIn}
			setAuthStatus={setAuthStatusCallback}
		/>);
		const elementRecipient = screen.getByPlaceholderText('translated_home_form_input_recipient_placeholder');
		const elementAmount = screen.getByPlaceholderText('translated_home_form_input_amount_placeholder');
		const elementButton = screen.getByText('translated_home_form_button_claim_text');
		const elementTwitterAuthButton = screen.queryByText('translated_home_form_button_auth_twitter');
		userEvent.type(elementRecipient, recipientAddress);
		userEvent.type(elementAmount, amount);
		fireEvent.click(elementButton);

		// Assert:
		expect(callback).toHaveBeenCalledWith(recipientAddress, amount);
		expect(elementTwitterAuthButton).not.toBeInTheDocument();
	});

	it('should render twitter auth form', () => {
		// Arrange:
		const onSubmitCallback = jest.fn();
		const accountSignIn = createSignInStatus(false);

		// Act:
		render(<FaucetForm
			addressFirstChar={addressFirstChar}
			currency={currency}
			maxAmount={maxAmount}
			onSubmit={onSubmitCallback}
			onAuthStatus={accountSignIn}
			setAuthStatus={setAuthStatusCallback}
		/>);
		const elementText = screen.getByText('translated_home_form_auth_description');
		const elementTwitterAuthButton = screen.getByText('translated_home_form_button_auth_twitter');
		const elementClaimButton = screen.queryByText('translated_home_form_button_claim_text');

		// Assert:
		expect(elementText).toBeInTheDocument();
		expect(elementTwitterAuthButton).toBeInTheDocument();
		expect(elementClaimButton).not.toBeInTheDocument();
	});
});
