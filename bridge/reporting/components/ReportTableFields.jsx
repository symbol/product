import { PAYOUT_STATUS_DETAILS } from '@/constants';
import styles from '@/styles/ReportTable.module.css';
import { createExplorerUrl, formatAtomicAmount, formatPpm, formatTimestamp, truncateMiddle } from '@/utils/format';

export const StatusBadge = ({ status, errorMessage }) => {
	const details = PAYOUT_STATUS_DETAILS[status] || { label: 'Unknown', tone: 'neutral' };
	const className = `${styles.statusBadge} ${styles[`status_${details.tone}`]}`;

	if (!errorMessage)
		return <span className={className}>{details.label}</span>;

	return (
		<span
			aria-label={`${details.label}: ${errorMessage}`}
			className={`${className} ${styles.statusWithTooltip}`}
			data-tooltip={errorMessage}
			tabIndex="0"
		>
			{details.label}
		</span>
	);
};

export const ExternalValue = ({ network, type, value, truncateType = 'default' }) => {
	const url = createExplorerUrl(network, type, value);
	const label = 'hash' === truncateType ? truncateMiddle(value, 8, 6) : truncateMiddle(value, 9, 6);

	if (!url)
		return <span title={value || ''}>{label}</span>;

	return (
		<a className={styles.externalValue} href={url} rel="noreferrer" target="_blank" title={value}>
			{label}
			<span aria-hidden="true" className={styles.externalMark}>↗</span>
		</a>
	);
};

export const TransactionValue = ({ hash, timestamp, network }) => (
	<div className={styles.transactionValue}>
		<span className={styles.timestamp}>{formatTimestamp(timestamp)}</span>
		<ExternalValue network={network} type="transaction" value={hash} truncateType="hash" />
	</div>
);

export const AmountValue = ({ value, asset }) => (
	<div className={styles.amountValue} title={value ?? ''}>
		<span>{formatAtomicAmount(value, asset.divisibility)}</span>
		{null !== value && value !== undefined && <small>{asset.ticker}</small>}
	</div>
);

export const RateValue = ({ value }) => (
	<span className={styles.rateValue} title={null === value || value === undefined ? '' : `${value} PPM`}>
		{formatPpm(value)}
	</span>
);
