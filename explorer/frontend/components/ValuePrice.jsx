import styles from '@/styles/components/ValuePrice.module.scss';

const ValuePrice = ({ value, change }) => {
	const changeText = change < 0 ? `${change}%` :`+${change}%` ;
	const changeClassName = change < 0 ? styles.changeDecrease : styles.changeIncrease;

	return (
		<div className={styles.valuePrice}>
			<div className={styles.value}>${value}</div>
			<div className={changeClassName}>{changeText}</div>
		</div>
	);
};

export default ValuePrice;
