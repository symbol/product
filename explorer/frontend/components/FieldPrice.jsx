import styles from '@/styles/components/FieldPrice.module.scss';

const FieldPrice = ({ value, change }) => {
	let changeText;
	let changeClassName;

	if (change < 0) {
		changeText = `${change}%`;
		changeClassName = styles.changeDecrease;
	} else {
		changeText = `+${change}%`;
		changeClassName = styles.changeIncrease;
	}

	return (
		<div className={styles.fieldPrice}>
			<div className={styles.value}>{value}</div>
			<div className={changeClassName}>{changeText}</div>
		</div>
	);
};

export default FieldPrice;
