import styles from '@/styles/components/Chart.module.scss';
import dynamic from 'next/dynamic';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const ChartColumns = ({ data = [], name }) => {
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
			type: 'bar',
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
			<div className={styles.chartColumn} id="chart">
				<ReactApexChart options={options} series={series} type="bar" height="100%" />
			</div>
			<div className={styles.name}>{name}</div>
		</div>
	);
};

export default ChartColumns;
