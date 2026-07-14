import config from '@/app/config';
import styles from '@/app/styles/components/ValueAccountBalance.module.scss';

const ValueDescription = ({ value }) => {
	return (
		<div className={styles.valueAccountBalance}>
			<div className={styles.value}>{value}</div>
			<div className={styles.ticker}>{config.PUBLIC_NATIVE_MOSAIC_TICKER}</div>
			<div className={styles.valueUSD}> ~${valueUSD}</div>
		</div>
	);
};

export default ValueDescription;
