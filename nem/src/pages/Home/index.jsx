import FaucetForm from '../../components/FaucetForm';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import Config from '../../config';
import { $t } from '../../i18n';
import { validateNEMAddress, absoluteToRelativeAmount } from '../../utils/helper';
import { getBreakpoint } from '../../utils/styles';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Home.scss';

// Setup toast
toast.configure();

const Home = function () {
	const [isFormPortrait, setIsFormPortrait] = useState(false);
	const divisibility = Config.DIVISIBILITY;
	const currency = Config.CURRENCY;
	const faucetAddress = Config.FAUCET_ADDRESS;
	const telegramChHelpdeskURL = Config.URL_TELEGRAM_CH_HELPDESK;
	const telegramChHelpdesk = Config.TELEGRAM_CH_HELPDESK;
	const discordChHelpdeskURL = Config.URL_DISCORD_CH_HELPDESK;
	const discordChHelpdesk = Config.DISCORD_CH_HELPDESK;
	const addressFirstChar = faucetAddress[0];
	const faucetAccountExplorerUrl = `${Config.URL_EXPLORER}/accounts/${faucetAddress}`;
	const maxAmount = absoluteToRelativeAmount(Config.MAX_AMOUNT, divisibility);
	const pageClassName = isFormPortrait ? 'page-container-portrait' : 'page-container-landscape';

	const [twitterAccountStatus, setTwitterAccountStatus] = useState({
		isSignIn: false,
		screenName: ''
	});

	useEffect(() => {
		const root = document.documentElement;

		// Subscribe to screen size change. Find a matching breakpoint and apply its styles.
		const resizeObserver = new ResizeObserver(entries => {
			entries.forEach(entry => {
				if (entry.target === root) {
					const { width, height } = entry.contentRect;
					const currentBreakpoint = getBreakpoint(width, height);
					root.className = currentBreakpoint.className;
					setIsFormPortrait(currentBreakpoint.portrait);
				}
			});
		});

		resizeObserver.observe(root);
	}, []);

	const handleSubmit = (recipientAddress, amount) => {
		// Validate form data.
		// Show error message if address or amount is not valid, otherwise show success message and call Faucet claim API.
		const numericAmount = Number(amount);
		const isAddressValid = validateNEMAddress(recipientAddress);
		const isAmountValid = !Number.isNaN(numericAmount) && 0 <= numericAmount && numericAmount <= maxAmount;
		const twitterInfo = JSON.parse(localStorage.getItem('twitterInfo'));

		let isTwitterVerify = false;

		if (twitterInfo) {
			const diff = new Date() - new Date(twitterInfo.createdAt);
			const accountAge = Math.floor(diff / (1000 * 60 * 60 * 24));

			isTwitterVerify = Config.MIN_FOLLOWERS_COUNT <= twitterInfo.followersCount && Config.MIN_ACCOUNT_AGE < accountAge;
		}

		if (!isAddressValid) {
			toast.error($t('notification_error_invalid_address'));
		} else if (!isAmountValid) {
			toast.error($t('notification_error_invalid_amount'));
		} else if (!isTwitterVerify) {
			toast.error($t('notification_error_unqualified_twitter_account'));
		} else {
			toast.info($t('notification_info_requested', {
				amount: numericAmount,
				address: recipientAddress,
				currency
			}));
		}

		// TODO: call Faucet API. FaucetService.claim(recipientAddress, numericAmount).then(toast.info).catch(toast.error);
	};

	return (
		<div id="app">
			<div className="main-container-wrapper">
				<div className="main-container">
					<Header />
					<div data-testid="home-page-content" className={pageClassName}>
						<div className="mb-base text-center">
							<p>
								<a className="faucet-address-link" target="_blank" href={faucetAccountExplorerUrl} rel="noreferrer">
									{faucetAddress}
								</a>
							</p>
						</div>
						<div className="content-container">
							<div className="content-col">
								<div className="mb-base text-center">
									<p className="hero pre-line">{$t('home_description')}</p>
								</div>
								<div className="faucet-form">
									<FaucetForm
										addressFirstChar={addressFirstChar}
										currency={currency}
										maxAmount={maxAmount}
										portrait={isFormPortrait}
										onSubmit={handleSubmit}
										onAuthStatus={twitterAccountStatus}
										setAuthStatus={setTwitterAccountStatus}
									/>
								</div>
							</div>
							<div className="content-separator" />
							<div className="content-col">
								<div className="lighter text-center">
									<p>
										{$t('home_body_text_p1')}
									</p>
									<p>
										{$t('home_body_text_p2_1')}
										<a target="_blank" href={telegramChHelpdeskURL} rel="noreferrer">{telegramChHelpdesk}</a>
										{$t('home_body_text_p2_2')}
										<a target="_blank" href={discordChHelpdeskURL} rel="noreferrer">{discordChHelpdesk}</a>
										{$t('home_body_text_p2_3')}
									</p>
								</div>
								<Footer />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Home;
