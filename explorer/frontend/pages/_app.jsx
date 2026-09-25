import { fetchBackendHealthStatus, healthConfig } from '@/app/api/health';
import Footer from '@/app/components/Footer';
import Header from '@/app/components/Header';
import PageLoadingIndicator from '@/app/components/PageLoadingIndicator';
import { publicAppConfig } from '@/app/config';
import { BACKEND_HEALTH_STATUS, STORAGE_KEY } from '@/app/constants';
import { ConfigProvider } from '@/app/contexts/ConfigContext';
import styles from '@/app/styles/pages/Layout.module.scss';
import { useStorage } from '@/app/utils';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';
import ja from 'javascript-time-ago/locale/ja.json';
import uk from 'javascript-time-ago/locale/uk.json';
import zh from 'javascript-time-ago/locale/zh.json';
import App from 'next/app';
import { useRouter } from 'next/router';
import { appWithTranslation } from 'next-i18next';
import { memo, useEffect, useRef, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '@/app/styles/globals.scss';

TimeAgo.addDefaultLocale(en);
TimeAgo.addLocale(uk);
TimeAgo.addLocale(zh);
TimeAgo.addLocale(ja);

const ROUTES_TO_RETAIN = ['/accounts', '/blocks', '/mosaics', '/namespaces', '/transactions'];

export const AppComponent = ({ Component, pageProps, appConfig }) => {
	const [userLanguage] = useStorage(STORAGE_KEY.USER_LANGUAGE);
	const router = useRouter();
	const retainedComponents = useRef({});
	const isRetainableRoute = ROUTES_TO_RETAIN.includes(router.asPath);
	const [backendHealthStatus, setBackendHealthStatus] = useState(BACKEND_HEALTH_STATUS.INITIAL);
	const [backendStatus, setBackendStatus] = useState(null);

	useEffect(() => {
		let isMounted = true;
		const fetchBackendStatus = async () => {
			try {
				const status = await fetchBackendHealthStatus();
				if (!isMounted)
					return;

				setBackendStatus(status);
				setBackendHealthStatus(status && typeof status.isHealthy === 'boolean'
					? BACKEND_HEALTH_STATUS.AVAILABLE
					: BACKEND_HEALTH_STATUS.UNAVAILABLE);
			} catch {
				if (isMounted)
					setBackendHealthStatus(BACKEND_HEALTH_STATUS.ERROR);
			}
		};

		fetchBackendStatus();
		return () => {
			isMounted = false;
		};
	}, []);

	if (isRetainableRoute && !retainedComponents.current[router.asPath]) {
		/* eslint-disable @eslint-react/static-components -- created once per route and cached in a ref */
		const MemoComponent = memo(Component);
		retainedComponents.current[router.asPath] = <MemoComponent {...pageProps} />;
		/* eslint-enable @eslint-react/static-components */
	}

	const getDisplayStyle = flag => ({ display: flag ? 'block' : 'none' });

	useEffect(() => {
		if (userLanguage && userLanguage !== router.locale)
			router.push(router.asPath, null, { locale: userLanguage });
	}, [userLanguage, router]);

	return (
		<div className={styles.wrapper}>
			{/* Baseline configuration; `/runtime-config.js` overrides it with the container's runtime values. */}
			<script dangerouslySetInnerHTML={{ __html: `window.appConfig = ${JSON.stringify(appConfig).replace(/</g, '\\u003c')};` }} />
			<ConfigProvider>
				<Header
					backendStatus={backendStatus}
					backendHealthStatus={backendHealthStatus}
					isHealthRequestWarningEnabled={healthConfig.isUnavailableWarningEnabled}
				/>
				<ToastContainer autoClose={2000} className="toast-container" hideProgressBar pauseOnHover />
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
						{!isRetainableRoute && <Component key={router.asPath} {...pageProps} />}
					</main>
				</div>
			</ConfigProvider>
			<Footer />
		</div>
	);
};

AppComponent.getInitialProps = async appContext => {
	const appProps = await App.getInitialProps(appContext);

	return { ...appProps, appConfig: publicAppConfig };
};

export default appWithTranslation(AppComponent);
