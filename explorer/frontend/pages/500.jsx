import styles from '@/styles/pages/500.module.scss';
import { createPageHref } from '@/utils';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getStaticProps = async ({ locale, err }) => {
	return {
		props: {
			error: err || null,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Error500 = ({ error }) => {
	const { t } = useTranslation();
	const errorNameText = error?.name || '';

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>500</title>
			</Head>
			<div className={styles.container}>
				<div className={styles.code}>500</div>
				<div className={styles.separator} />
				<div className={styles.text}>
					<div className={styles.description}>{`${t('message_500')} ${errorNameText}`}</div>
					<Link className={styles.link} href={createPageHref('home')}>
						{t('button_backHome')}
					</Link>
				</div>
			</div>
		</div>
	);
};

export default Error500;
