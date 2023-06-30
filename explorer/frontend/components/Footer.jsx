import styles from '@/styles/components/Footer.module.scss';
import CustomImage from './CustomImage';

const Footer = () => (
	<footer className={styles.footer}>
		<CustomImage className={styles.footerLogo} src="/images/logo-nem.png" alt="NEM" />
	</footer>
);

export default Footer;
