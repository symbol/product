import ButtonCopy from '@/components/ButtonCopy';
import styles from '@/styles/components/ValueCopy.module.scss';

const ValueCopy = ({ className, value }) => {
	return (
		<div className={`${styles.valueCopy} ${className}`}>
			<div className={styles.text}>{value}</div>
			<ButtonCopy value={value} />
		</div>
	);
};

export default ValueCopy;
