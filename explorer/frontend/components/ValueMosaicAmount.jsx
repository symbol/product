import styles from '@/styles/components/ValueMosaicAmount.module.scss';
import { numberToString } from '@/utils';

const ValueMosaicAmount = ({ value }) => {
	if (value === null || value === undefined)
		return null;

	const [integerPart, fractionalPart] = `${value}`.split('.');
	const formattedIntegerPart = numberToString(integerPart);

	if (fractionalPart === undefined)
		return formattedIntegerPart;

	return (
		<span>
			{formattedIntegerPart}
			<span className={styles.fractionalPart}>.{fractionalPart}</span>
		</span>
	);
};

export default ValueMosaicAmount;
