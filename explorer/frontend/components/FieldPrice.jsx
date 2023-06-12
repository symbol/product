import styles from '@/styles/components/FieldPrice.module.scss';

const FieldPrice = ({ value, change }) => {
	const changeText = `${Math.sign(change)}${change}%`;
	const changeClassName = change < 0 ? styles.changeDecrease : styles.changeIncrease;

	return (
		<div className={styles.fieldPrice}>
			<div className={styles.value}>{value}</div>
			<div className={changeClassName}>{changeText}</div>
		</div>
	);
};

export default FieldPrice;
