import styles from '@/styles/components/ValueTransactionSquares.module.scss';
import dynamic from 'next/dynamic';
import { renderToString } from 'react-dom/server';
import ValueMosaic from './ValueMosaic';

const ReactApexChart = dynamic(
	() => import('react-apexcharts'),
	{ ssr: false }
);

const Tooltip = ({fee}) => (
	<ValueMosaic mosaicId="6BED913FA20223F8" amount={fee} />
);


const ValueTransactionSquares = ({ data }) => {
	const series = [
		{
			data: [
				{
					x: '1.2',
					y: 1.2,
					fillColor: '#52B12C'
				},
				{
					x: '0.4',
					y: 0.4,
					fillColor: '#F3BA2F'
				},
				{
					x: '1.8',
					y: 1.8,
					fillColor: '#F3BA2F'
				},
				{
					x: '1.9',
					y: 1.9,
					fillColor: '#52B12C'
				},
				{
					x: '0.03',
					y: 0.1,
					fillColor: '#B94F4F'
				},
			]
		}
	];
	const options = {
		legend: {
			show: false
		},
		stroke: {
			colors: ['rgb(224, 243, 241)']
		},
		chart: {
			width: '100%',
			type: 'treemap',
			animations: {
				enabled: false,
			},
			toolbar: {
				show: false,
			},
			sparkline: {
				enabled: true
			}
		},
		dataLabels: {
			enabled: false,
			style: {
				fontSize: '12px',
			},
			formatter: function (text, op) {
				return [text, op.value]
			},
			offsetY: -4
		},
		plotOptions: {
			treemap: {
				enableShades: false,
				useFillColorAsStroke: false,
				shadeIntensity: 1,
			}
		},
		tooltip: {
			custom: ({ series, seriesIndex, dataPointIndex, w }) => {
				const fee = series[seriesIndex][dataPointIndex];
				return renderToString(<Tooltip size={113} fee={fee}/>);
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
		<div className={styles.valueTransactionSquares} id="chart">
			<ReactApexChart
				options={options}
				series={series}
				type="treemap"
				height="100%"
			/>
		</div>
	)
}

export default ValueTransactionSquares;
