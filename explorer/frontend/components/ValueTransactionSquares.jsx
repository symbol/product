import LoadingIndicator from './LoadingIndicator';
import ValueMosaic from './ValueMosaic';
import ValueTransaction from './ValueTransaction';
import styles from '@/app/styles/components/ValueTransactionSquares.module.scss';
import { styleVariables } from '@/app/variants/styles';
import dynamic from 'next/dynamic';
import { useTranslation } from 'next-i18next';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

// The largest block the fee treemap is drawn for. It caps the single request that has to return every
// transaction of the block.
export const MAX_TRANSACTION_SQUARES = 250;

const Tooltip = ({ fee }) => <ValueMosaic isNative amount={fee} />;

const ValueTransactionSquares = ({ data = [], transactionCount, isTransactionPreviewEnabled, isLoading, className }) => {
	const { t } = useTranslation('common');
	const isChartPresentable = transactionCount <= MAX_TRANSACTION_SQUARES;
	const [selectedTransaction, setSelectedTransaction] = useState(null);
	const series = [
		{
			data: data.map(item => ({
				x: `${item.fee}`,
				y: item.fee,
				fillColor: styleVariables.colorTransactionSquare
			}))
		}
	];
	const options = {
		legend: {
			show: false
		},
		stroke: {
			colors: [styleVariables.colorChartDonutStroke]
		},
		chart: {
			width: '100%',
			type: 'treemap',
			animations: {
				enabled: false
			},
			toolbar: {
				show: false
			},
			sparkline: {
				enabled: true
			},
			events: {
				dataPointSelection: (event, config, { dataPointIndex }) => {
					const transaction = data[dataPointIndex];
					setSelectedTransaction(currentValue => (currentValue?.hash === transaction.hash ? null : transaction));
				}
			}
		},
		dataLabels: {
			format: 'scale',
			enabled: true,
			offsetY: -3,
			style: {
				colors: [styleVariables.colorTransactionSquareText]
			}
		},
		plotOptions: {
			treemap: {
				enableShades: false,
				useFillColorAsStroke: false,
				shadeIntensity: 1
			}
		},
		tooltip: {
			custom: ({ series, seriesIndex, dataPointIndex, w }) => {
				const fee = series[seriesIndex][dataPointIndex];
				return renderToString(<Tooltip fee={fee} />);
			}
		},
		states: {
			hover: {
				filter: {
					type: 'none'
				}
			}
		}
	};

	return (
		<div className={`${styles.valueTransactionSquares} ${className}`} id="chart">
			{!!data.length && !isLoading && isChartPresentable && (
				<ReactApexChart className={styles.chart} options={options} series={series} type="treemap" height="100%" />
			)}
			{!data.length && !isLoading && isChartPresentable && <div className={styles.emptyDataMessage}>{t('message_emptyTable')}</div>}
			{!isLoading && !isChartPresentable && (
				<div className={styles.emptyDataMessage}>{t('message_tooManyTransactionsToVisualize')}</div>
			)}
			{!!isTransactionPreviewEnabled && !!selectedTransaction && (
				<div className={styles.selectedTransaction}>
					<ValueTransaction
						type={selectedTransaction.type}
						value={selectedTransaction.hash}
						amount={selectedTransaction.amount}
					/>
				</div>
			)}
			{isLoading && (
				<div className={styles.loadingIndicator}>
					<LoadingIndicator />
				</div>
			)}
		</div>
	);
};

export default ValueTransactionSquares;
