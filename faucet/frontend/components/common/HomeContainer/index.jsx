import FaucetForm from '../../../components/common/FaucetForm';
import Footer from '../../../components/common/Footer';
import Header from '../../../components/common/Header';
import { absoluteToRelativeAmount } from '../../../utils/helper';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import 'react-toastify/dist/ReactToastify.css';

const HomeContainer = function (props) {
	const { homeConfig, Config } = props;

	const backendRequest = axios.create();
	backendRequest.defaults.baseURL = Config.BACKEND_URL;

	const [backendConfig, setBackendConfig] = useState({
		faucetAddress: '',
		currency: '',
		sendOutMaxAmount: 0,
		mosaicDivisibility: 6,
		minFollowers: 10,
		minAccountAge: 30,
		faucetBalance: 0
	});

	const {faucetAddress} = backendConfig;
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
		maxAmount: absoluteToRelativeAmount(backendConfig.sendOutMaxAmount, backendConfig.mosaicDivisibility),
		currency: backendConfig.currency,
		addressFirstChar: faucetAddress[0],
		minFollowers: backendConfig.minFollowers,
		minAccountAge: backendConfig.minAccountAge,
		theme: 'light',
		aesSecret: Config.AES_SECRET
	};

	useEffect(() => {
		// Get config information from backend
		const getConfigInformation = async () => {
			const { data } = await backendRequest.get(homeConfig.configUrl);

			if (data)
				setBackendConfig({...data});
		};

		getConfigInformation();
	}, []);

	return (
		<div className="main-container-wrapper">
			<div className="main-container">
				<Header
					logoImageSrc={homeConfig.logoImage}
					logoWordmarkSrc={homeConfig.logoWord}
					faucetAddressLink={faucetAccountExplorerUrl}
				/>
				<div data-testid="home-page-content" className={pageClassName}>
					<div className="mb-base text-center">
						<p>
							{
								absoluteToRelativeAmount(backendConfig.faucetBalance, backendConfig.mosaicDivisibility)
							} { backendConfig.currency }
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
