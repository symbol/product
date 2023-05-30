import Button from '../Button';
import TextBox from '../TextBox';
import TwitterSignIn from '../TwitterSignIn';
import axios from 'axios';
import { decode } from 'jsonwebtoken';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';

const FaucetForm = function ({ config, addressValidation }) {
	const toastConfig = {
		theme: config.theme,
		bodyClassName: 'toast-body',
		progressClassName: 'toast-progress'
	};

	const backendRequest = axios.create();

	backendRequest.defaults.baseURL = config.backendUrl;

	const [isLoading, setIsLoading] = useState(false);
	const [recipientAddress, setRecipientAddress] = useState('');
	const [amount, setAmount] = useState('');
	const [onAuthStatus, setAuthStatus] = useState({
		isSignedIn: false,
		screenName: ''
	});

	// default set 20% of max amount
	const defaultAmount = Number(config.maxAmount * 0.2);

	const recipientPlaceholder = $t('home_form_input_recipient_placeholder', {
		char: config.addressFirstChar
	});

	const amountPlaceholder = $t('home_form_input_amount_placeholder', {
		currency: config.currency,
		maxAmount: config.maxAmount.toLocaleString('en'),
		defaultAmount: defaultAmount.toLocaleString('en')
	});

	const getTwitterVerifyStatus = twitterInfo => {
		let isTwitterVerify = false;

		if (twitterInfo) {
			const diff = new Date() - new Date(twitterInfo.createdAt);
			const accountAge = Math.floor(diff / (1000 * 60 * 60 * 24));

			isTwitterVerify = config.minFollowers <= twitterInfo.followersCount && config.minAccountAge < accountAge;
		}

		return isTwitterVerify;
	};

	const showErrorToast = errorMessage => toast.error($t(errorMessage), toastConfig);

	const handleAddressOnChange = value => {
		const formattedAddress = value.replace(/-/g, '').replace(/\s/g, '');
		setRecipientAddress(formattedAddress);
	};

	const handleAmountOnChange = value => {
		const regex = new RegExp(/^(\d{1,}([,.]\d{1,6})?)?$/);
		value.match(regex) && setAmount(value);
	};

	const formSubmitHandler = () => {
		const formattedAddress = recipientAddress.replace(/-/g, '');
		const numericAmount = 0 === Number(amount) ? defaultAmount : Number(amount);
		const isAddressValid = addressValidation(formattedAddress);
		const isAmountValid = !Number.isNaN(numericAmount) && 0 <= numericAmount && numericAmount <= config.maxAmount;
		const twitterInfo = decode(sessionStorage.getItem('authToken'));

		const isTwitterVerify = getTwitterVerifyStatus(twitterInfo);

		const claimToken = async () => {
			setIsLoading(true);

			try {
				const { data } = await backendRequest.post(
					config.claimUrl,
					{
						address: formattedAddress,
						amount: numericAmount,
						twitterHandle: onAuthStatus.screenName
					},
					{
						headers: {
							'Content-Type': 'application/json',
							'authToken': sessionStorage.getItem('authToken')
						}
					}
				);

				toast.info($t('notification_info_requested', {
					amount: numericAmount,
					address: formattedAddress,
					currency: config.currency
				}), toastConfig);

				toast.info(<a href={`${config.transactionHashExplorerUrl}${data.transactionHash}`} target={'_blank'} rel="noreferrer">
						View in Explorer
				</a>, toastConfig);
			} catch (error) {
				if (error.response) {
					const { data } = error.response;

					if ('BadRequest' === data.code)
						showErrorToast('notification_' + data.message);
					else
						showErrorToast('notification_error_node');

				} else if (error.request) {
					showErrorToast('notification_error_backend_not_responding');
				} else {
					showErrorToast('notification_error_frontend_request_fail');
				}
			}

			setIsLoading(false);
		};

		if (!isAddressValid) {
			showErrorToast('notification_error_address_invalid');
			return;
		}
		else if (!isAmountValid) {
			showErrorToast('notification_error_amount_invalid');
			return;
		}
		else if (!isTwitterVerify) {
			showErrorToast('notification_error_unqualified_twitter_account');
			return;
		}

		claimToken();
	};

	useEffect(() => {
		const queryParams = new URLSearchParams(window.location.search);
		const recipientAddress = queryParams.get('recipient');

		if (onAuthStatus.isSignedIn) {
			setRecipientAddress(recipientAddress || sessionStorage.getItem('recipientAddress'));
			sessionStorage.removeItem('recipientAddress');
		} else {
			if (recipientAddress)
				sessionStorage.setItem('recipientAddress', recipientAddress);

		}
	}, [onAuthStatus]);

	return (
		<div data-testid="faucet-form" className="form">
			{
				onAuthStatus.isSignedIn
					? (
						<div>
							<TextBox
								value={recipientAddress || ''}
								placeholder={recipientPlaceholder}
								required
								onChange={handleAddressOnChange}
							/>
							<TextBox
								value={amount || ''}
								type="number"
								min={0}
								max={config.maxAmount}
								placeholder={amountPlaceholder}
								onChange={handleAmountOnChange}
							/>
							<Button isLoading={isLoading} onClick={formSubmitHandler}>{$t('home_form_button_claim_text')}</Button>
						</div>
					)
					: <p>{$t('home_form_auth_description')}</p>
			}

			<div className="form-auth">
				<TwitterSignIn
					twitterAccountStatus={onAuthStatus}
					setTwitterAccountStatus={setAuthStatus}
					authUrl={config.authUrl}
				/>
			</div>

			<ToastContainer />
		</div>
	);
};

FaucetForm.propTypes = {
	addressValidation: PropTypes.func,
	config: PropTypes.shape({
		claimUrl: PropTypes.string,
		authUrl: PropTypes.string,
		backendUrl: PropTypes.string,
		transactionHashExplorerUrl: PropTypes.string,
		maxAmount: PropTypes.number,
		currency: PropTypes.string,
		addressFirstChar: PropTypes.string,
		minFollowers: PropTypes.number,
		minAccountAge: PropTypes.number,
		theme: PropTypes.string
	}).isRequired
};

export default FaucetForm;
