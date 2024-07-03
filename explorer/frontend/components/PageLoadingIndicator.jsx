import styles from '@/styles/components/PageLoadingIndicator.module.scss';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const PageLoadingIndicator = () => {
	const [isPageLoading, setIsPageLoading] = useState(false);
	const router = useRouter();

	useEffect(() => {
		const handleStart = () => setIsPageLoading(true);
		const handleComplete = () => setIsPageLoading(false);

		router.events.on('routeChangeStart', handleStart);
		router.events.on('routeChangeComplete', handleComplete);
		router.events.on('routeChangeError', handleComplete);

		return () => {
			router.events.off('routeChangeStart', handleStart);
			router.events.off('routeChangeComplete', handleComplete);
			router.events.off('routeChangeError', handleComplete);
		};
	});

	return isPageLoading ? (
		<div className={styles.pageLoadingIndicator}>
			<svg className={styles.logo} viewBox="0 0 2250 2242" fill="none" xmlns="http://www.w3.org/2000/svg">
				{/* eslint-disable max-len */}
				<path
					d="M2249.99 292.646C2243.14 810.769 2060.15 1304.91 1744.89 1699.67C1749.69 1668.14 1752.43 1635.93 1752.43 1603.72C1752.43 1374.81 1629.07 1174.69 1446.08 1065.03C1443.34 1063.66 1440.6 1061.61 1437.86 1060.24C1278.86 967.714 1180.17 797.062 1180.17 612.018C1180.17 326.228 1412.5 93.8945 1698.29 93.8945C1746.95 93.8945 1794.92 100.748 1840.84 113.77C1982.02 159.688 2119.09 219.999 2249.99 292.646Z"
					fill="#67B9E8"
				/>
				<path
					d="M1473.5 26.7286C1238.43 117.195 1070.51 345.416 1070.51 612.016C1070.51 803.914 965.656 971.824 810.082 1061.61C734.008 1105.47 646.284 1130.14 552.391 1130.14C319.372 1130.14 115.824 973.881 53.4572 752.513C20.5605 603.107 2.74139 448.903 0 292.644C344.045 100.746 731.952 0 1125.34 0C1242.54 0 1359.05 8.90949 1473.5 26.7286Z"
					fill="#FAB600"
				/>
				<path
					d="M1643.47 1603.71C1643.47 1738.73 1590.7 1868.26 1496.81 1964.89C1383.72 2068.38 1258.99 2160.9 1125.35 2241.09C680.556 1975.86 343.365 1570.82 159.691 1099.98C267.977 1187.02 405.732 1239.11 553.082 1239.11C664.108 1239.11 768.281 1210.32 859.432 1158.92C861.489 1157.55 863.545 1156.87 865.601 1155.5C944.416 1109.58 1034.2 1084.91 1126.03 1084.91C1219.93 1084.91 1307.65 1109.58 1383.72 1153.44C1538.61 1243.91 1643.47 1411.82 1643.47 1603.71Z"
					fill="#4FBAAD"
				/>
				{/* eslint-enable max-len */}
			</svg>
		</div>
	) : null;
};

export default PageLoadingIndicator;
