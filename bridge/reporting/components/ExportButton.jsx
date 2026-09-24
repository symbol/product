import { fetchAllReportRows } from '@/api/bridge';
import styles from '@/styles/ReportPanel.module.css';
import { ERROR_CSV_COLUMNS, REQUEST_CSV_COLUMNS, downloadCsv, serializeCsv } from '@/utils/csv';
import { useEffect, useRef, useState } from 'react';

const ExportButton = ({ criteria, tab }) => {
	const [isExporting, setIsExporting] = useState(false);
	const [exportedRows, setExportedRows] = useState(0);
	const [error, setError] = useState('');
	const abortControllerRef = useRef(null);

	useEffect(() => () => abortControllerRef.current?.abort(), []);

	const exportRows = async () => {
		if (isExporting)
			return;

		abortControllerRef.current = new AbortController();
		setIsExporting(true);
		setExportedRows(0);
		setError('');
		try {
			const rows = await fetchAllReportRows({ ...criteria, signal: abortControllerRef.current.signal }, setExportedRows);
			const columns = 'requests' === tab.resource ? REQUEST_CSV_COLUMNS : ERROR_CSV_COLUMNS;
			const csv = serializeCsv(rows, columns, tab);
			const date = new Date().toISOString().slice(0, 10);
			downloadCsv(csv, `symbol-bridge-${tab.id}-${date}.csv`);
		} catch (caughtError) {
			if ('CanceledError' !== caughtError.name)
				setError('CSV export failed. No file was created.');
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<div className={styles.exportArea}>
			<button className={styles.exportButton} disabled={isExporting} onClick={exportRows} type="button">
				<span aria-hidden="true">↓</span>
				{isExporting ? `Exporting ${exportedRows} rows` : 'Export all CSV'}
			</button>
			{error && <span className={styles.exportError} role="alert">{error}</span>}
		</div>
	);
};

export default ExportButton;
