import ButtonCopy from '@/app/components/ButtonCopy';
import styles from '@/app/styles/components/ValueCopy.module.scss';

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
