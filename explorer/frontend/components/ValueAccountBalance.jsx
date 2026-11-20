import config from '@/app/config';
import styles from '@/app/styles/components/ValueAccountBalance.module.scss';
import { numberToShortString, numberToString, truncateDecimals } from '@/app/utils';

const ValueAccountBalance = ({ value, valueInUserCurrency, userCurrency }) => {
	const userCurrencyText = userCurrency.toUpperCase();
	const truncatedValueInUserCurrency = truncateDecimals(valueInUserCurrency, 2);
	const valueInUserCurrencyText = valueInUserCurrency == null
		? '—'
		: `~${numberToShortString(truncatedValueInUserCurrency)} ${userCurrencyText}`;
	const valueInUserCurrencyTitle = valueInUserCurrency == null
		? undefined
		: `${numberToString(truncatedValueInUserCurrency)} ${userCurrencyText}`;

	return (
		<div className={styles.valueAccountBalance}>
			<div className={styles.value}>{numberToString(value)}</div>
			<div className={styles.ticker}>{config.PUBLIC_NATIVE_MOSAIC_TICKER}</div>
			<div className={styles.valueUSD} title={valueInUserCurrencyTitle}>
				{' '}
				{valueInUserCurrencyText}
			</div>
		</div>
	);
};

export default ValueAccountBalance;
