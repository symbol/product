import { fetchBridgeConfiguration } from '@/api/bridge';
import ReportPanel from '@/components/ReportPanel';
import ReportTabs from '@/components/ReportTabs';
import config from '@/config';
import { BRIDGE_TABS } from '@/constants';
import styles from '@/styles/Home.module.css';
import Head from 'next/head';
import Image from 'next/image';
import { useState } from 'react';

export const getServerSideProps = async () => {
	const bridgeConfigurations = await fetchBridgeConfiguration();

	return {
		props: {
			bridgeBaseUrls: {
				native: config.PUBLIC_BRIDGE_NATIVE_URL,
				wrapped: config.PUBLIC_BRIDGE_WRAPPED_URL
			},
			bridgeConfigurations
		}
	};
};

export const Home = ({ bridgeBaseUrls, bridgeConfigurations }) => {
	const [activeTabId, setActiveTabId] = useState(BRIDGE_TABS[0].id);
	const activeTab = BRIDGE_TABS.find(tab => tab.id === activeTabId);
	const bridgeTypes = [...new Set(BRIDGE_TABS.map(tab => tab.bridgeType))];
	const onlineBridgeCount = bridgeTypes.filter(bridgeType => bridgeConfigurations[bridgeType]?.enabled).length;
	const bridgeNetwork = bridgeTypes
		.map(bridgeType => bridgeConfigurations[bridgeType]?.nativeNetwork?.network)
		.find(network => network)
		?.toUpperCase() || 'UNKNOWN';

	return (
		<div className={styles.page}>
			<Head>
				<title>Symbol Bridge Monitor</title>
				<meta content="Monitor Symbol bridge wrap, unwrap, payout, and error records." name="description" />
			</Head>

			<header className={styles.hero}>
				<div className={styles.brandRow}>
					<div className={styles.brand}>
						<Image alt="Symbol" height={38} priority src="/images/logo.png" width={38} />
						<div><strong>Bridge Monitor</strong></div>
					</div>
					<div className={styles.networkStatus}>
						<span />{bridgeNetwork} · {onlineBridgeCount}/{bridgeTypes.length} BRIDGES ONLINE
					</div>
				</div>
			</header>

			<main className={styles.console}>
				<div className={styles.consoleHeading}>
					<div><span>Active report</span><strong>{activeTab.label}</strong></div>
				</div>
				<ReportTabs activeTabId={activeTabId} onChange={setActiveTabId} tabs={BRIDGE_TABS} />
				<div className={styles.panelStack}>
					{BRIDGE_TABS.map(tab => (
						<ReportPanel
							baseUrl={bridgeBaseUrls[tab.bridgeType]}
							isActive={tab.id === activeTabId}
							key={tab.id}
							tab={tab}
						/>
					))}
				</div>
			</main>
		</div>
	);
};

export default Home;
