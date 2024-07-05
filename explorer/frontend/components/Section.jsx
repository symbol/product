import Card from './Card';
import styles from '@/styles/components/Section.module.scss';
import { useState } from 'react';

const Section = ({ children, title, tabs, className, cardClassName }) => {
	const [selectedTabIndex, setSelectedTabIndex] = useState(0);
	const content = tabs ? tabs[selectedTabIndex].content : children;

	const getTabStyle = tabIndex => (selectedTabIndex == tabIndex ? `${styles.tab} ${styles.tab__active}` : styles.tab);

	return (
		<div className={`${styles.section} ${className}`}>
			<div className={styles.titleRow}>
				<h3>{title}</h3>
				{!!tabs && (
					<div className={styles.tabs}>
						{tabs.map((item, index) => (
							<div key={index} className={getTabStyle(index)} onClick={() => setSelectedTabIndex(index)}>
								{item.label}
							</div>
						))}
					</div>
				)}
			</div>
			<Card className={cardClassName}>{content}</Card>
		</div>
	);
};

export default Section;
