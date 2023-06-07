import styles from '@/styles/pages/404.module.scss';
import Head from 'next/head';

const Error = () => {
	return (
		<div className={styles.wrapper}>
			<Head>
				<title>Error</title>
			</Head>
			<div>
				<h2>404</h2>
				Requested resource not found...
			</div>
		</div>
	);
};

export default Error;
