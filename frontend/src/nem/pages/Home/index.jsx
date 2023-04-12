import '../../i18n';
import 'react-toastify/dist/ReactToastify.css';
import '../../styles/globals.scss';
import '../../styles/pages/Home.scss';
import '../../styles/components/Button.scss';
import '../../styles/components/FaucetForm.scss';
import '../../styles/components/Footer.scss';
import '../../styles/components/Header.scss';
import '../../styles/components/TextBox.scss';
import FaucetForm from '../../../common/components/FaucetForm';
import Footer from '../../../common/components/Footer';
import Header from '../../../common/components/Header';
import { validateNEMAddress, absoluteToRelativeAmount } from '../../../common/utils/helper';
import { getBreakpoint } from '../../../common/utils/styles';
import DiscordIconSrc from '../../assets/images/icon-discord.svg';
import ExplorerIconSrc from '../../assets/images/icon-explorer.svg';
import GithubIconSrc from '../../assets/images/icon-github.svg';
import TwitterIconSrc from '../../assets/images/icon-twitter.svg';
import LogoWordmarkSrc from '../../assets/images/logo-wordmark.svg';
import LogoImageSrc from '../../assets/images/nem-logo-2.png';
import Config from '../../config';
import breakpoints from '../../config/breakpoints.json';
import axios from 'axios';
import { decode } from 'jsonwebtoken';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

// Setup toast
const toastConfig = {
	theme: 'light',
	bodyClassName: 'toast-body',
	progressClassName: 'toast-progress'
};
toast.configure();

const backendRequest = axios.create({
	baseURL: Config.BACKEND_URL
});
const footerLinks = [{
	href: Config.URL_EXPLORER,
	text: $t('footer_link_explorer'),
	icon: ExplorerIconSrc
}, {
	href: Config.URL_DISCORD,
	text: $t('footer_link_discord'),
	icon: DiscordIconSrc
}, {
	href: Config.URL_GITHUB,
	text: $t('footer_link_github'),
	icon: GithubIconSrc
}, {
	href: Config.URL_TWITTER,
	text: $t('footer_link_twitter'),
	icon: TwitterIconSrc
}];

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
	const faucetAccountExplorerUrl = `${Config.URL_EXPLORER}/#/s_account?account=${faucetAddress}`;
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
					const currentBreakpoint = getBreakpoint(width, height, breakpoints);
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
		const twitterInfo = decode(localStorage.getItem('authToken'));

		let isTwitterVerify = false;

		if (twitterInfo) {
			const diff = new Date() - new Date(twitterInfo.createdAt);
			const accountAge = Math.floor(diff / (1000 * 60 * 60 * 24));

			isTwitterVerify = Config.MIN_FOLLOWERS_COUNT <= twitterInfo.followersCount && Config.MIN_ACCOUNT_AGE < accountAge;
		}

		const claimToken = async () => {
			try {
				const { data } = await backendRequest.post(
					'/claim/xem',
					{
						address: recipientAddress,
						amount: numericAmount
					},
					{
						headers: {
							'Content-Type': 'application/json',
							'authToken': localStorage.getItem('authToken')
						}
					}
				);

				toast.info($t('notification_info_requested', {
					amount: numericAmount,
					address: recipientAddress,
					currency
				}), toastConfig);

				toast.info(<a href={`${Config.URL_EXPLORER}/#/s_tx?hash=${data.transactionHash}`} target={'_blank'} rel="noreferrer">
						View in Explorer
				</a>, toastConfig);
			} catch (error) {
				if (error.response) {
					const { data } = error.response;

					if ('BadRequest' === data.code) 
						toast.error($t('notification_' + data.message), toastConfig);
					 else 
						toast.error($t('notification_error_nem_node'), toastConfig);
					

				} else if (error.request) {
					toast.error($t('notification_error_backend_not_responding'), toastConfig);
				} else {
					toast.error($t('notification_error_frontend_request_fail'), toastConfig);
				}
			}
		};

		if (!isAddressValid) 
			toast.error($t('notification_error_invalid_address'), toastConfig);
		 else if (!isAmountValid) 
			toast.error($t('notification_error_invalid_amount'), toastConfig);
		 else if (!isTwitterVerify) 
			toast.error($t('notification_error_unqualified_twitter_account'), toastConfig);
		 else 
			claimToken();
		
	};

	return (
		<div id="app">
			<div className="main-container-wrapper">
				<div className="main-container">
					<Header logoImageSrc={LogoImageSrc} logoWordmarkSrc={LogoWordmarkSrc} />
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
										authUrl={Config.AUTH_URL}
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
								<Footer links={footerLinks} />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Home;
