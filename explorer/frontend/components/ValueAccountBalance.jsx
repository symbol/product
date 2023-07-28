import config from '@/config';
import styles from '@/styles/components/ValueAccountBalance.module.scss';

const ValueAccountBalance = ({ value, valueUSD }) => {
	return (
		<div className={styles.valueAccountBalance}>
			<div className={styles.value}>{value}</div>
			<div className={styles.ticker}>{config.NATIVE_MOSAIC_TICKER}</div>
			<div className={styles.valueUSD}> ~${valueUSD}</div>
		</div>
	);
};

export default ValueAccountBalance;
