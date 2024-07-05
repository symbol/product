import ButtonCopy from '@/components/ButtonCopy';
import styles from '@/styles/components/ValueCopy.module.scss';

const ValueCopy = ({ className, value }) => {
	const isValueExist = value !== null;
	return isValueExist ? (
		<div className={`${styles.valueCopy} ${className}`}>
			<div className={styles.text}>{value}</div>
			<ButtonCopy value={value} />
		</div>
	) : (
		<div>-</div>
	);
};

export default ValueCopy;
