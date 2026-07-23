import { PAYOUT_STATUS_DETAILS } from '@/constants';
import styles from '@/styles/ReportTable.module.css';
import { createExplorerUrl, formatAtomicAmount, formatPpm, formatTimestamp, truncateMiddle } from '@/utils/format';

const StatusBadge = ({ status, errorMessage }) => {
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

const ExternalValue = ({ network, type, value, truncateType = 'default' }) => {
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

const TransactionValue = ({ hash, timestamp, network }) => (
	<div className={styles.transactionValue}>
		<span className={styles.timestamp}>{formatTimestamp(timestamp)}</span>
		<ExternalValue network={network} type="transaction" value={hash} truncateType="hash" />
	</div>
);

const AmountValue = ({ value, asset }) => (
	<div className={styles.amountValue} title={value ?? ''}>
		<span>{formatAtomicAmount(value, asset.divisibility)}</span>
		{null !== value && value !== undefined && <small>{asset.ticker}</small>}
	</div>
);

const RateValue = ({ value }) => (
	<span className={styles.rateValue} title={null === value || value === undefined ? '' : `${value} PPM`}>
		{formatPpm(value)}
	</span>
);

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

const RequestRow = ({ row, tab, configuration }) => {
	const sourceNetwork = configuration?.[tab.sourceNetwork];
	const destinationNetwork = configuration?.[tab.destinationNetwork];

	return (
		<tr>
			<td><StatusBadge status={row.payoutStatus} errorMessage={row.errorMessage} /></td>
			<td><ExternalValue network={sourceNetwork} type="address" value={row.senderAddress} /></td>
			<td><TransactionValue hash={row.requestTransactionHash} timestamp={row.requestTimestamp} network={sourceNetwork} /></td>
			<td><AmountValue value={row.requestAmount} asset={tab.sourceAsset} /></td>
			<td><ExternalValue network={destinationNetwork} type="address" value={row.destinationAddress} /></td>
			<td><TransactionValue hash={row.payoutTransactionHash} timestamp={row.payoutTimestamp} network={destinationNetwork} /></td>
			<td><RateValue value={row.payoutConversionRate} /></td>
			<td><AmountValue value={row.payoutTotalFee} asset={tab.destinationAsset} /></td>
			<td><AmountValue value={row.payoutNetAmount} asset={tab.destinationAsset} /></td>
		</tr>
	);
};

const ErrorRow = ({ row, tab, configuration }) => {
	const sourceNetwork = configuration?.[tab.sourceNetwork];
	return (
		<tr>
			<td><ExternalValue network={sourceNetwork} type="address" value={row.senderAddress} /></td>
			<td><TransactionValue hash={row.requestTransactionHash} timestamp={row.requestTimestamp} network={sourceNetwork} /></td>
			<td className={styles.errorMessage}>{row.errorMessage || '—'}</td>
		</tr>
	);
};

const MobileField = ({ label, children, wide }) => (
	<div className={`${styles.mobileField} ${wide ? styles.mobileFieldWide : ''}`}>
		<dt>{label}</dt>
		<dd>{children}</dd>
	</div>
);

const RequestCard = ({ row, tab, configuration }) => {
	const sourceNetwork = configuration?.[tab.sourceNetwork];
	const destinationNetwork = configuration?.[tab.destinationNetwork];
	return (
		<article className={styles.mobileCard}>
			<div className={styles.mobileCardTop}>
				<span className={styles.mobileRowId}>#{row.requestTransactionHeight}</span>
				<StatusBadge status={row.payoutStatus} errorMessage={row.errorMessage} />
			</div>
			<dl className={styles.mobileGrid}>
				<MobileField label="Sender">
					<ExternalValue network={sourceNetwork} type="address" value={row.senderAddress} />
				</MobileField>
				<MobileField label="Request" wide>
					<TransactionValue
						hash={row.requestTransactionHash}
						network={sourceNetwork}
						timestamp={row.requestTimestamp}
					/>
				</MobileField>
				<MobileField label="Request amount">
					<AmountValue asset={tab.sourceAsset} value={row.requestAmount} />
				</MobileField>
				<MobileField label="Payout Address">
					<ExternalValue network={destinationNetwork} type="address" value={row.destinationAddress} />
				</MobileField>
				<MobileField label="Payout" wide>
					<TransactionValue
						hash={row.payoutTransactionHash}
						network={destinationNetwork}
						timestamp={row.payoutTimestamp}
					/>
				</MobileField>
				<MobileField label="Rate">
					<RateValue value={row.payoutConversionRate} />
				</MobileField>
				<MobileField label="Fee">
					<AmountValue asset={tab.destinationAsset} value={row.payoutTotalFee} />
				</MobileField>
				<MobileField label="Payout amount">
					<AmountValue asset={tab.destinationAsset} value={row.payoutNetAmount} />
				</MobileField>
			</dl>
		</article>
	);
};

const ErrorCard = ({ row, tab, configuration }) => {
	const sourceNetwork = configuration?.[tab.sourceNetwork];
	return (
		<article className={styles.mobileCard}>
			<div className={styles.mobileCardTop}>
				<span className={styles.mobileRowId}>#{row.requestTransactionHeight}</span>
				<span className={`${styles.statusBadge} ${styles.status_danger}`}>Error</span>
			</div>
			<dl className={styles.mobileGrid}>
				<MobileField label="Sender">
					<ExternalValue network={sourceNetwork} type="address" value={row.senderAddress} />
				</MobileField>
				<MobileField label="Request" wide>
					<TransactionValue
						hash={row.requestTransactionHash}
						network={sourceNetwork}
						timestamp={row.requestTimestamp}
					/>
				</MobileField>
				<MobileField label="Error message" wide>{row.errorMessage || '—'}</MobileField>
			</dl>
		</article>
	);
};

const ReportTable = ({ rows, tab, configuration, sort, onSortChange }) => {
	const isRequests = 'requests' === tab.resource;
	return (
		<>
			<table className={`${styles.table} ${isRequests ? styles.requestTable : styles.errorTable}`}>
				<thead>
					{isRequests ? (
						<tr>
							<th>Payout status</th>
							<th>Sender address</th>
							<th aria-sort={0 === sort ? 'descending' : 'ascending'}>
								<SortHeader onSortChange={onSortChange} sort={sort} />
							</th>
							<th>Request amount</th>
							<th>Payout address</th>
							<th>Payout hash</th>
							<th>Conversion rate</th>
							<th>Payout fee</th>
							<th>Payout amount</th>
						</tr>
					) : (
						<tr>
							<th>Sender address</th>
							<th aria-sort={0 === sort ? 'descending' : 'ascending'}>
								<SortHeader onSortChange={onSortChange} sort={sort} />
							</th>
							<th>Error message</th>
						</tr>
					)}
				</thead>
				<tbody>
					{rows.map(row => isRequests
						? (
							<RequestRow
								configuration={configuration}
								key={`${row.requestTransactionHash}-${row.requestTransactionSubindex}`}
								row={row}
								tab={tab}
							/>
						)
						: (
							<ErrorRow
								configuration={configuration}
								key={`${row.requestTransactionHash}-${row.requestTransactionSubindex}`}
								row={row}
								tab={tab}
							/>
						))}
				</tbody>
			</table>
			<div className={styles.mobileList}>
				{rows.map(row => isRequests
					? (
						<RequestCard
							configuration={configuration}
							key={`${row.requestTransactionHash}-${row.requestTransactionSubindex}`}
							row={row}
							tab={tab}
						/>
					)
					: (
						<ErrorCard
							configuration={configuration}
							key={`${row.requestTransactionHash}-${row.requestTransactionSubindex}`}
							row={row}
							tab={tab}
						/>
					))}
			</div>
		</>
	);
};

export default ReportTable;
