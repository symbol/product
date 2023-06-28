import styles from '@/styles/components/ValueCopy.module.scss';
import ButtonCopy from '@/components/ButtonCopy';

const ValueCopy = ({ value }) => {

	return (
		<div className={styles.valueCopy}>
			<div className={styles.text}>{value}</div>
			<ButtonCopy value={value} />
		</div>
	)
}

export default ValueCopy;
