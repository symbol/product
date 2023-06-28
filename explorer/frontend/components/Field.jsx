import styles from '@/styles/components/Field.module.scss';

const textAlignStyleMap = {
	right: styles.textAlignRight
};

const Field = ({ title, children, textAlign }) => {
	const textAlignStyle = textAlignStyleMap[textAlign];

	return (
		<div className={`${styles.field} ${textAlignStyle}`}>
			<div className={styles.title}>{title}</div>
			<div className={styles.value}>{children}</div>
		</div>
	)
}

export default Field;
