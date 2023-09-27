import styles from '@/styles/pages/404.module.scss';
import { createPageHref } from '@/utils';
import Head from 'next/head';
import Link from 'next/link';
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
				<title>{'Error'}</title>
			</Head>
			<div className={styles.container}>
				<div className={styles.code}>404</div>
				<div className={styles.separator} />
				<div className={styles.text}>
					<div className={styles.description}>{"We can't seem to find the resource you're looking for."}</div>
					<Link className={styles.link} href={createPageHref('home')}>
						{'Back To Home'}
					</Link>
				</div>
			</div>
		</div>
	);
};

export default Error;
