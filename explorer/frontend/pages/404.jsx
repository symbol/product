import styles from '@/styles/pages/404.module.scss';
import Head from 'next/head';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getStaticProps = async ({ locale }) => {
	return {
		props: {
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Error = () => {
	return (
		<div className={styles.wrapper}>
			<Head>
				<title>Error</title>
			</Head>
			<div className={styles.container}>
				<h2>404</h2>
				Requested resource not found...
			</div>
		</div>
	);
};

export default Error;
