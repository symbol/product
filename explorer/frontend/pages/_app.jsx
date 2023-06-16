import Footer from '@/components/Footer';
import Header from '@/components/Header';
import styles from '@/styles/pages/Layout.module.scss';
import '@/styles/globals.scss';
import { appWithTranslation } from 'next-i18next';
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import ru from 'javascript-time-ago/locale/ru.json'


TimeAgo.addDefaultLocale(en)
TimeAgo.addLocale(ru)

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

export default appWithTranslation(App);
