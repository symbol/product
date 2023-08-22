import styles from '@/styles/components/SectionHeaderTransaction.module.scss';
import CustomImage from './CustomImage';
import ValueTimestamp from './ValueTimestamp';

const SectionHeaderTransaction = ({ height, timestamp }) => {
	return (
		<div className={styles.sectionHeader}>
			<CustomImage className={styles.sectionHeaderIcon} src="/images/icon-transaction-header-block.svg" alt="Block" />
			<div>
				<div className={styles.sectionHeaderTitle}>{height}</div>
				<ValueTimestamp value={timestamp} hasTime/>
			</div>
		</div>
	);
};

export default SectionHeaderTransaction;
