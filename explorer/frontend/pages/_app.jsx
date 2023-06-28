import { memo, useRef } from 'react';
import { useRouter } from 'next/router';
import { appWithTranslation } from 'next-i18next';
import { ToastContainer } from 'react-toastify';
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import uk from 'javascript-time-ago/locale/uk.json'
import zh from 'javascript-time-ago/locale/zh.json'
import ja from 'javascript-time-ago/locale/ja.json'
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import styles from '@/styles/pages/Layout.module.scss';
import 'react-toastify/dist/ReactToastify.css';
import '@/styles/globals.scss';

TimeAgo.addDefaultLocale(en);
TimeAgo.addLocale(uk);
TimeAgo.addLocale(zh);
TimeAgo.addLocale(ja);

const ROUTES_TO_RETAIN = ['/blocks'];

const App = ({ Component, pageProps }) => {
	const router = useRouter();
	const retainedComponents = useRef({});
	const isRetainableRoute = ROUTES_TO_RETAIN.includes(router.asPath);

	if (isRetainableRoute && !retainedComponents.current[router.asPath]) {
		const MemoComponent = memo(Component);
		retainedComponents.current[router.asPath] = <MemoComponent {...pageProps} />;
	}

	const getDisplayStyle = (flag) => ({ display: flag ? 'block' : 'none' });

	return (
		<div className={styles.wrapper}>
			<Header />
			<ToastContainer
				autoClose={2000}
				hideProgressBar
				pauseOnHover
			/>
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
