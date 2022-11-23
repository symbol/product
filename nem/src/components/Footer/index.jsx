import DiscordIconSrc from '../../assets/images/icon-discord.svg';
import ExplorerIconSrc from '../../assets/images/icon-explorer.svg';
import GithubIconSrc from '../../assets/images/icon-github.svg';
import TwitterIconSrc from '../../assets/images/icon-twitter.svg';
import Config from '../../config';
import { $t } from '../../i18n';
import React from 'react';
import './Footer.scss';

const Footer = function () {
	const links = [{
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

	return (
		<div className="footer">
			{links.map((item, index) => (
				<a className="link-container" target="_blank" rel="noopener noreferrer" href={item.href} key={`link${index}`}>
					<img className="link-icon" src={item.icon} alt={item.text} />
					<div className="link-text">{item.text}</div>
				</a>
			))}
		</div>
	);
};

export default Footer;
