import '../../i18n';
import '../../styles/globals.scss';
import '../../styles/pages/Home.scss';
import '../../styles/components/Button.scss';
import '../../styles/components/FaucetForm.scss';
import '../../styles/components/Footer.scss';
import '../../styles/components/Header.scss';
import '../../styles/components/TextBox.scss';
import { validateSymbolAddress } from '../../../../utils/helper';
import { getBreakpoint } from '../../../../utils/styles';
import HomeContainer from '../../../common/HomeContainer';
import DiscordIconSrc from '../../assets/images/icon-discord.svg';
import ExplorerIconSrc from '../../assets/images/icon-explorer.svg';
import GithubIconSrc from '../../assets/images/icon-github.svg';
import TwitterIconSrc from '../../assets/images/icon-twitter.svg';
import LogoWordmarkSrc from '../../assets/images/logo-wordmark.svg';
import LogoImageSrc from '../../assets/images/symbol-faucet-icon.svg';
import Config from '../../config';
import breakpoints from '../../config/breakpoints.json';
import React, { useEffect, useRef, useState } from 'react';

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
	const [isArtShown, setIsArtShown] = useState(false);
	const [isMobileArtShown, setIsMobileArtShown] = useState(false);
	const artContainerRef = useRef();

	const homeConfig = {
		claimUrl: '/claim/xym',
		configUrl: '/config/xym',
		transactionHashExplorerPath: '/transactions/',
		accountExplorerPath: '/accounts/',
		theme: 'dark',
		logoWord: LogoWordmarkSrc,
		logoImage: LogoImageSrc,
		footerLinks: footerLinks,
		isFormPortrait: isFormPortrait,
		validateAddress: validateSymbolAddress
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
				else if (entry.target === artContainerRef.current) {
					const bgRect = entry.contentRect;
					const artShouldBeShown = 5 > bgRect.height / bgRect.width;
					const mobileArtShouldBeShown = 15 > bgRect.height / bgRect.width;
					setIsArtShown(artShouldBeShown);
					setIsMobileArtShown(!artShouldBeShown && mobileArtShouldBeShown);
				}
			});
		});

		resizeObserver.observe(root);
		resizeObserver.observe(artContainerRef.current);
	}, []);

	return (
		<div id="app">
			<div className="bg-container">
				<div className="bg-art-container" >
					<div className="position-relative" ref={artContainerRef} data-testid="art-container">
						{isArtShown && <div className="bg-image bg-image-left" data-testid="bg-image-left"/>}
						{isMobileArtShown && <div className="bg-image-mobile bg-image-mobile-left" data-testid="bg-image-mobile-left" />}
					</div>
					<div className="bg-art-middle" />
					<div className="position-relative">
						{isArtShown && <div className="bg-image bg-image-right" data-testid="bg-image-right"/>}
						{isMobileArtShown && <div className="bg-image-mobile bg-image-mobile-right" data-testid="bg-image-mobile-right" />}
					</div>
				</div>
				<div className="bg-gradient-dark" />
			</div>
			<HomeContainer
				homeConfig={homeConfig}
				Config={Config}
			/>
		</div>
	);
};

export default Home;
