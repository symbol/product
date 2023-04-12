import Button from '../Button';
import TextBox from '../TextBox';
import TwitterSignIn from '../TwitterSignIn';
import PropTypes from 'prop-types';
import React, { useState } from 'react';

const FaucetForm = function (props) {
	const {
		addressFirstChar, currency, maxAmount, onSubmit, onAuthStatus, setAuthStatus, authUrl
	} = props;
	const [recipientAddress, setRecipientAddress] = useState('');
	const [amount, setAmount] = useState('');

	const recipientPlaceholder = $t('home_form_input_recipient_placeholder', {
		char: addressFirstChar
	});
	const amountPlaceholder = $t('home_form_input_amount_placeholder', {
		currency,
		maxAmount: Number(maxAmount).toLocaleString('en')
	});

	const formSubmitHandler = () => {
		onSubmit(recipientAddress, amount);
	};

	return (
		<div className="form">
			{
				onAuthStatus.isSignIn
					? (
						<div>
							<TextBox value={recipientAddress} placeholder={recipientPlaceholder} required onChange={setRecipientAddress} />
							<TextBox
								value={amount}
								type="number"
								min={0}
								max={maxAmount}
								placeholder={amountPlaceholder}
								onChange={setAmount}
							/>
							<Button onClick={formSubmitHandler}>{$t('home_form_button_claim_text')}</Button>
						</div>
					)
					: <p>{$t('home_form_auth_description')}</p>
			}

			<div className="form-auth">
				<TwitterSignIn
					twitterAccountStatus={onAuthStatus}
					setTwitterAccountStatus={setAuthStatus}
					authUrl={authUrl}
				/>
			</div>
		</div>
	);
};

FaucetForm.propTypes = {
	addressFirstChar: PropTypes.string.isRequired,
	currency: PropTypes.string.isRequired,
	maxAmount: PropTypes.number.isRequired,
	onSubmit: PropTypes.func.isRequired,
	onAuthStatus: PropTypes.exact({
		isSignIn: PropTypes.bool.isRequired,
		screenName: PropTypes.string.isRequired
	}).isRequired,
	setAuthStatus: PropTypes.func.isRequired
};

export default FaucetForm;
