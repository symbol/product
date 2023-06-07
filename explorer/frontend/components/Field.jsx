import styles from '@/styles/components/Field.module.scss';

const Field = ({ title, children }) => (
	<div className={styles.field}>
		<div className={styles.title}>{title}</div>
		<div>{children}</div>
	</div>
);

export default Field;
