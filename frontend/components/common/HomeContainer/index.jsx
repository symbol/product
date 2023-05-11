import FaucetForm from '../../../components/common/FaucetForm';
import Footer from '../../../components/common/Footer';
import Header from '../../../components/common/Header';
import { absoluteToRelativeAmount } from '../../../utils/helper';
import React from 'react';
import 'react-toastify/dist/ReactToastify.css';

const HomeContainer = function (props) {
	const { homeConfig, Config } = props;

	const faucetAddress = Config.FAUCET_ADDRESS;
	const telegramChHelpDeskURL = Config.URL_TELEGRAM_CH_HELP_DESK;
	const telegramChHelpDesk = Config.TELEGRAM_CH_HELP_DESK;
	const discordChHelpDeskURL = Config.URL_DISCORD_CH_HELP_DESK;
	const discordChHelpDesk = Config.DISCORD_CH_HELP_DESK;
	const pageClassName = homeConfig.isFormPortrait ? 'page-container-portrait' : 'page-container-landscape';
	const faucetAccountExplorerUrl = `${Config.URL_EXPLORER}${homeConfig.accountExplorerPath}${faucetAddress}`;

	const formConfig = {
		claimUrl: homeConfig.claimUrl,
		authUrl: Config.AUTH_URL,
		backendUrl: Config.BACKEND_URL,
		transactionHashExplorerUrl: `${Config.URL_EXPLORER}${homeConfig.transactionHashExplorerPath}`,
		maxAmount: absoluteToRelativeAmount(Config.MAX_AMOUNT, Config.DIVISIBILITY),
		currency: Config.CURRENCY,
		addressFirstChar: faucetAddress[0],
		minFollowers: Config.MIN_FOLLOWERS_COUNT,
		minAccountAge: Config.MIN_ACCOUNT_AGE,
		theme: 'light'
	};

	return (
		<div className="main-container-wrapper">
			<div className="main-container">
				<Header logoImageSrc={homeConfig.logoImage} logoWordmarkSrc={homeConfig.logoWord} />
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
								<p className="hero pre-line">
									{$t('home_description', { maxAmount: formConfig.maxAmount.toLocaleString('en') })}
								</p>
							</div>
							<div className="faucet-form">
								<FaucetForm
									config={formConfig}
									addressValidation={homeConfig.validateAddress}
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
									<a target="_blank" href={telegramChHelpDeskURL} rel="noreferrer">{telegramChHelpDesk}</a>
									{$t('home_body_text_p2_2')}
									<a target="_blank" href={discordChHelpDeskURL} rel="noreferrer">{discordChHelpDesk}</a>
									{$t('home_body_text_p2_3')}
								</p>
							</div>
							<Footer links={homeConfig.footerLinks} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default HomeContainer;
