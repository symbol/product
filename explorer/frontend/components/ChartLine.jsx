import styles from '@/styles/components/Chart.module.scss';
import dynamic from 'next/dynamic';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const ChartLine = ({ data, name }) => {
	const series = [
		{
			name: name,
			data: data.map(item => item[1])
		}
	];
	const options = {
		legend: {
			show: false
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
			zoom: {
				enabled: false
			}
		},
		dataLabels: {
			enabled: false
		},
		colors: ['#50B9AD'],
		stroke: {
			curve: 'smooth',
			width: 1
		},
		xaxis: {
			categories: data.map(item => item[0])
		}
	};

	return (
		<div className={styles.container}>
			<div className={styles.chartLine} id="chart">
				<ReactApexChart options={options} series={series} type="line" height="100%" />
			</div>
		</div>
	);
};

export default ChartLine;
