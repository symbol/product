import { PAYOUT_STATUS_DETAILS } from '@/constants';
import { formatAtomicAmount, formatPpm, formatTimestamp, isValueMissing } from '@/utils/format';

export const REQUEST_CSV_COLUMNS = [
	['Sender Address', 'senderAddress'],
	['Request Transaction Hash', 'requestTransactionHash'],
	['Request Transaction Height', 'requestTransactionHeight'],
	['Request Transaction Subindex', 'requestTransactionSubindex'],
	['Request Timestamp', 'requestTimestamp'],
	['Request Amount', 'requestAmount'],
	['Destination Address', 'destinationAddress'],
	['Payout Transaction Hash', 'payoutTransactionHash'],
	['Payout Transaction Height', 'payoutTransactionHeight'],
	['Payout Timestamp', 'payoutTimestamp'],
	['Payout Total Fee', 'payoutTotalFee'],
	['Payout Net Amount', 'payoutNetAmount'],
	['Payout Conversion Rate', 'payoutConversionRate'],
	['Payout Status', 'payoutStatus'],
	['Error Message', 'errorMessage']
];

export const ERROR_CSV_COLUMNS = [
	['Sender Address', 'senderAddress'],
	['Request Transaction Hash', 'requestTransactionHash'],
	['Request Transaction Height', 'requestTransactionHeight'],
	['Request Transaction Subindex', 'requestTransactionSubindex'],
	['Request Timestamp', 'requestTimestamp'],
	['Error Message', 'errorMessage']
];

export const escapeCsvValue = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

const formatCsvAmount = (value, asset) => {
	const amount = formatAtomicAmount(value, asset.divisibility);
	return isValueMissing(value) ? amount : `${amount} ${asset.ticker}`;
};

export const formatCsvValue = (value, key, tab) => {
	switch (key) {
	case 'requestAmount':
		return formatCsvAmount(value, tab.sourceAsset);
	case 'payoutTotalFee':
	case 'payoutNetAmount':
		return formatCsvAmount(value, tab.destinationAsset);
	case 'payoutConversionRate':
		return formatPpm(value);
	case 'payoutStatus':
		return PAYOUT_STATUS_DETAILS[value]?.label || 'Unknown';
	case 'requestTimestamp':
	case 'payoutTimestamp':
		return formatTimestamp(value);
	case 'errorMessage':
		return escapeCsvValue(value);
	default:
		return value;
	}
};

export const serializeCsv = (rows, columns, tab) => {
	const header = columns.map(([label]) => label).join(',');
	const body = rows.map(row => columns.map(([, key]) => formatCsvValue(row[key], key, tab)).join(',')).join('\n');

	return `${header}\n${body}`;
};

export const downloadCsv = (content, filename) => {
	const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
};
