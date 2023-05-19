import '../../i18n';
import '../../styles/globals.scss';
import '../../styles/pages/Home.scss';
import '../../styles/components/Button.scss';
import '../../styles/components/FaucetForm.scss';
import '../../styles/components/Footer.scss';
import '../../styles/components/Header.scss';
import '../../styles/components/TextBox.scss';
import { validateNEMAddress } from '../../../../utils/helper';
import { getBreakpoint } from '../../../../utils/styles';
import HomeContainer from '../../../common/HomeContainer';
import DiscordIconSrc from '../../assets/images/icon-discord.svg';
import ExplorerIconSrc from '../../assets/images/icon-explorer.svg';
import GithubIconSrc from '../../assets/images/icon-github.svg';
import TwitterIconSrc from '../../assets/images/icon-twitter.svg';
import LogoWordmarkSrc from '../../assets/images/logo-wordmark.svg';
import LogoImageSrc from '../../assets/images/nem-faucet-icon.svg';
import Config from '../../config';
import breakpoints from '../../config/breakpoints.json';
import React, { useEffect, useState } from 'react';

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

	const homeConfig = {
		claimUrl: '/claim/xem',
		configUrl: '/config/xem',
		transactionHashExplorerPath: '/#/s_tx?hash=',
		accountExplorerPath: '/#/s_account?account=',
		theme: 'light',
		logoWord: LogoWordmarkSrc,
		logoImage: LogoImageSrc,
		footerLinks: footerLinks,
		isFormPortrait: isFormPortrait,
		validateAddress: validateNEMAddress
	};

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

	return (
		<div id="app">
			<HomeContainer
				homeConfig={homeConfig}
				Config={Config}
			/>
		</div>
	);
};

export default Home;
