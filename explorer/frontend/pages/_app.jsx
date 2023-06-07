import Footer from '@/components/Footer';
import Header from '@/components/Header';
import styles from '@/styles/pages/Layout.module.scss';
import '@/styles/globals.scss';

const App = ({ Component, pageProps }) => (
	<div className={styles.wrapper}>
		<Header />
		<div className={styles.contentContainer}>
			<main className={styles.contentContainerInner}>
				<Component {...pageProps} />
			</main>
		</div>
		<Footer />
	</div>
);

export default App;
