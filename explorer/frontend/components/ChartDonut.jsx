import { styleVariables } from '@/styles';
import styles from '@/styles/components/Chart.module.scss';
import dynamic from 'next/dynamic';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const ChartDonut = ({ data, name, label }) => {
	const colorMain = styleVariables.colorChartDonutMain;
	const colorEnd = styleVariables.colorChartDonutBackground;
	const colors = [...Array(Math.max(data.length - 1, 0)).fill(colorMain), colorEnd];
	const series = data.map(item => item[0]);
	const options = {
		legend: {
			show: false
		},
		chart: {
			width: '100%',
			type: 'donut',
			animations: {
				enabled: false
			},
			toolbar: {
				show: false
			},
			sparkline: {
				enabled: true
			},
			zoom: {
				enabled: false
			}
		},
		dataLabels: {
			enabled: false
		},
		colors,
		stroke: {
			curve: 'smooth',
			width: 1,
			colors: [styleVariables.colorChartDonutStroke]
		},
		labels: data.map(item => item[1]),
		tooltip: {
			fillSeriesColor: false
		}
	};

	return (
		<div className={styles.container}>
			<div className={styles.donutLabel}>{label}</div>
			<div className={styles.chartDonut} id="chart">
				<ReactApexChart options={options} series={series} type="donut" height="100%" />
			</div>
			<div className={styles.name}>{name}</div>
		</div>
	);
};

export default ChartDonut;
