import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageLoadingIndicator from '@/components/PageLoadingIndicator';
import { STORAGE_KEY } from '@/constants';
import styles from '@/styles/pages/Layout.module.scss';
import { useStorage } from '@/utils';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';
import ja from 'javascript-time-ago/locale/ja.json';
import uk from 'javascript-time-ago/locale/uk.json';
import zh from 'javascript-time-ago/locale/zh.json';
import { useRouter } from 'next/router';
import { appWithTranslation } from 'next-i18next';
import { memo, useEffect, useRef } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '@/styles/globals.scss';

TimeAgo.addDefaultLocale(en);
TimeAgo.addLocale(uk);
TimeAgo.addLocale(zh);
TimeAgo.addLocale(ja);

const ROUTES_TO_RETAIN = ['/accounts', '/blocks', '/mosaics', '/namespaces', '/transactions'];

const App = ({ Component, pageProps }) => {
	const [userLanguage] = useStorage(STORAGE_KEY.USER_LANGUAGE);
	const router = useRouter();
	const retainedComponents = useRef({});
	const isRetainableRoute = ROUTES_TO_RETAIN.includes(router.asPath);

	if (isRetainableRoute && !retainedComponents.current[router.asPath]) {
		const MemoComponent = memo(Component);
		retainedComponents.current[router.asPath] = <MemoComponent {...pageProps} />;
	}

	const getDisplayStyle = flag => ({ display: flag ? 'block' : 'none' });

	useEffect(() => {
		if (userLanguage && userLanguage !== router.locale) {
			router.push(router.asPath, null, { locale: userLanguage });
		}
	}, [userLanguage, router.locale]);

	return (
		<div className={styles.wrapper}>
			<Header />
			<ToastContainer autoClose={2000} hideProgressBar pauseOnHover />
			<PageLoadingIndicator />
			<div className={styles.contentContainer}>
				<main className={styles.contentContainerInner}>
					<div style={getDisplayStyle(isRetainableRoute)}>
						{Object.entries(retainedComponents.current).map(([path, component]) => (
							<div style={getDisplayStyle(router.asPath === path)} key={path}>
								{component}
							</div>
						))}
					</div>
					{!isRetainableRoute && <Component {...pageProps} />}
				</main>
			</div>
			<Footer />
		</div>
	);
};

export default appWithTranslation(App);
