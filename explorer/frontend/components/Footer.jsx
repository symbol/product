import CustomImage from './CustomImage';
import config from '@/config';
import styles from '@/styles/components/Footer.module.scss';
import layoutStyles from '@/styles/pages/Layout.module.scss';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'next-i18next';

const socialLinks = [
	{
		name: 'GitHub',
		icon: '/images/social/github.svg',
		href: config.SOCIAL_URL_GITHUB
	},
	{
		name: 'Discord',
		icon: '/images/social/discord.svg',
		href: config.SOCIAL_URL_DISCORD
	},
	{
		name: 'Twitter',
		icon: '/images/social/twitter.svg',
		href: config.SOCIAL_URL_TWITTER
	}
];

const resourcesLinks = [
	{
		text: 'footer_link_techRef',
		href: config.FOOTER_URL_TECHNICAL_REFERENCE
	},
	{
		text: 'footer_link_docs',
		href: config.FOOTER_URL_DOCS
	}
];

const productsLinks = [
	{
		text: 'footer_link_faucet',
		href: config.FOOTER_URL_FAUCET
	},
	{
		text: 'footer_link_supernode',
		href: config.FOOTER_URL_SUPERNODE_PROGRAM
	}
];


const Footer = () => {
	const { t } = useTranslation();
	const pathname = usePathname();
	const isFooterWithInfoShown = pathname === '/';

	return (
		<footer className={styles.footer}>
			<div className={layoutStyles.contentContainer}>
				{!isFooterWithInfoShown && (
					<div className={styles.footerSimplified}>
						<CustomImage className={styles.footerLogo} src="/images/logo-nem-outline.svg" alt="NEM" />
					</div>
				)}
				{isFooterWithInfoShown && (
					<div className={`${layoutStyles.contentContainerInner} ${styles.footerInner}`}>
						<CustomImage className={styles.footerLogo} src="/images/logo-nem-outline.svg" alt="NEM" />
						<div className={styles.footerLinksContainer}>
							<div className={styles.footerLinks}>
								<h7 className={styles.title}>{t('footer_title_section_1')}</h7>
								{resourcesLinks.map(({ text, href }) => (
									<a
										key={text}
										href={href}
										target="_blank"
										rel="noopener noreferrer"
										className={styles.footerLink}
									>
										{t(text)}
									</a>
								))}
							</div>
							<div className={styles.footerLinks}>
								<h7 className={styles.title}>{t('footer_title_section_2')}</h7>
								{productsLinks.map(({ text, href }) => (
									<a
										key={text}
										href={href}
										target="_blank"
										rel="noopener noreferrer"
										className={styles.footerLink}
									>
										{t(text)}
									</a>
								))}
							</div>
						</div>
						<div className={styles.socialLinks}>
							{socialLinks.map(({ name, href, icon }) => (
								<a
									key={name}
									href={href}
									target="_blank"
									rel="noopener noreferrer"
									className={styles.socialLink}
								>
									<CustomImage src={icon} alt={name} className={styles.socialIcon} />
								</a>
							))}
						</div>
					</div>
				)}
			</div>
		</footer>
	);
};

export default Footer;
