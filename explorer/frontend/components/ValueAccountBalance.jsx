import config from '@/config';
import styles from '@/styles/components/ValueAccountBalance.module.scss';
import { truncateDecimals } from '@/utils';

const ValueAccountBalance = ({ value, valueInUserCurrency, userCurrency }) => {
	return (
		<div className={styles.valueAccountBalance}>
			<div className={styles.value}>{value}</div>
			<div className={styles.ticker}>{config.NATIVE_MOSAIC_TICKER}</div>
			<div className={styles.valueUSD}>
				{' '}
				~{truncateDecimals(valueInUserCurrency, 2)} {userCurrency}
			</div>
		</div>
	);
};

export default ValueAccountBalance;
