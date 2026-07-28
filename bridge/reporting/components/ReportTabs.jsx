import styles from '@/styles/ReportTabs.module.css';

const ReportTabs = ({ tabs, activeTabId, onChange }) => {
	return (
		<div className={styles.scroller}>
			<div className={styles.tabs} role="tablist" aria-label="Bridge report views">
				{tabs.map((tab, index) => {
					const isActive = tab.id === activeTabId;
					return (
						<button
							aria-controls={`panel-${tab.id}`}
							aria-selected={isActive}
							className={`${styles.tab} ${isActive ? styles.active : ''}`}
							id={`tab-${tab.id}`}
							key={tab.id}
							onClick={() => onChange(tab.id)}
							role="tab"
							tabIndex={isActive ? 0 : -1}
						>
							<span className={styles.tabIndex}>{String(index + 1).padStart(2, '0')}</span>
							{tab.label}
						</button>
					);
				})}
			</div>
		</div>
	);
};

export default ReportTabs;
