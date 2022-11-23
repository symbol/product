import { $t } from '../../i18n';
import Button from '../Button';
import TextBox from '../TextBox';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import './FaucetForm.scss';

const FaucetForm = function (props) {
	const {
		showAuth, addressFirstChar, currency, maxAmount, onAuthRequest, onSubmit
	} = props;
	const [recipientAddress, setRecipientAddress] = useState(props.recipientAddress);
	const [amount, setAmount] = useState('');

	const recipientPlaceholder = $t('home_form_input_recipient_placeholder', {
		char: addressFirstChar
	});
	const amountPlaceholder = $t('home_form_input_amount_placeholder', {
		currency,
		maxAmount: Number(maxAmount).toLocaleString('en')
	});

	const claimFormClassName = showAuth ? 'form-hide' : '';

	const formSubmitHandler = () => {
		onSubmit(recipientAddress, amount);
	};

	return (
		<div className="form">
			<div className={claimFormClassName}>
				<TextBox value={recipientAddress} placeholder={recipientPlaceholder} required onChange={setRecipientAddress} />
				<TextBox value={amount} type="number" min={0} max={maxAmount} placeholder={amountPlaceholder} onChange={setAmount} />
				<Button onClick={formSubmitHandler}>{$t('home_form_button_claim_text')}</Button>
			</div>
			{showAuth && (
				<div className="form form-auth">
					<p>{$t('home_form_auth_description')}</p>
					<Button onClick={onAuthRequest}>{$t('home_form_button_auth_twitter')}</Button>
				</div>
			)}
		</div>
	);
};

FaucetForm.propTypes = {
	recipientAddress: PropTypes.string,
	showAuth: PropTypes.bool,
	addressFirstChar: PropTypes.string.isRequired,
	currency: PropTypes.string.isRequired,
	maxAmount: PropTypes.number.isRequired,
	onSubmit: PropTypes.func.isRequired,
	onAuthRequest: PropTypes.func
};

FaucetForm.defaultProps = {
	recipientAddress: '',
	showAuth: false,
	onAuthRequest: () => {}
};

export default FaucetForm;
