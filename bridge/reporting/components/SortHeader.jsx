import styles from '@/styles/ReportTable.module.css';

const SortHeader = ({ sort, onSortChange }) => (
	<button
		aria-label={`Sort by request block height ${0 === sort ? 'ascending' : 'descending'}`}
		className={styles.sortButton}
		onClick={onSortChange}
		title="Sorted by request block height"
		type="button"
	>
		Request hash
		<span aria-hidden="true">{0 === sort ? '↓' : '↑'}</span>
	</button>
);

export default SortHeader;
