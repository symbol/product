import CustomImage from './CustomImage';
import ValueBlockHeight from './ValueBlockHeight';
import ValueTimestamp from './ValueTimestamp';
import styles from '@/styles/components/SectionHeaderTransaction.module.scss';

const SectionHeaderTransaction = ({ height, timestamp }) => {
	return (
		<div className={styles.sectionHeader}>
			<CustomImage className={styles.sectionHeaderIcon} src="/images/icon-transaction-header-block.svg" alt="Block" />
			<div>
				<ValueBlockHeight className={styles.sectionHeaderTitle} value={height} />
				<ValueTimestamp value={timestamp} hasTime />
			</div>
		</div>
	);
};

export default SectionHeaderTransaction;
