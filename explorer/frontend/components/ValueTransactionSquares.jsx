import styles from '@/styles/components/ValueTransactionSquares.module.scss';
import dynamic from 'next/dynamic';
import { renderToString } from 'react-dom/server';
import ValueMosaic from './ValueMosaic';

const ReactApexChart = dynamic(
	() => import('react-apexcharts'),
	{ ssr: false }
);

const Tooltip = ({fee}) => (
	<ValueMosaic isNative amount={fee} />
);


const ValueTransactionSquares = ({ data, className }) => {
	const colorHigh = '#52B12C';
	const colorMedium = '#F3BA2F';
	const colorLow = '#B94F4F';

	const colors = [colorHigh, colorMedium, colorLow];

	const series = [
		{
			data: data.map((item) => ({
				x: item.fee,
				y: item.fee,
				fillColor: colorHigh, //colors[Math.round(Math.random(3))]
			}))
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
		<div className={`${styles.valueTransactionSquares} ${className}`} id="chart">
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
