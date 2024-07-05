import styles from '@/styles/pages/404.module.scss';
import { createPageHref } from '@/utils';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getStaticProps = async ({ locale }) => {
	return {
		props: {
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Error404 = () => {
	const { t } = useTranslation();

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>404</title>
			</Head>
			<div className={styles.container}>
				<div className={styles.code}>404</div>
				<div className={styles.separator} />
				<div className={styles.text}>
					<div className={styles.description}>{t('message_404')}</div>
					<Link className={styles.link} href={createPageHref('home')}>
						{t('button_backHome')}
					</Link>
				</div>
			</div>
		</div>
	);
};

export default Error404;
