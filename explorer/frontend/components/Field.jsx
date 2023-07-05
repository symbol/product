import CustomImage from './CustomImage';
import styles from '@/styles/components/Field.module.scss';

const textAlignStyleMap = {
	right: styles.textAlignRight
};

const Field = ({ title, description, children, textAlign }) => {
	const textAlignStyle = textAlignStyleMap[textAlign];

	return (
		<div className={`${styles.field} ${textAlignStyle}`}>
			<div className={styles.title}>
				{title}
				{!!description && (
					<div className={styles.tooltip}>
						<CustomImage src="/images/icon-question.svg" className={styles.tooltipIcon} />
						<div className={styles.tooltipContent}>{description}</div>
					</div>
				)}
			</div>
			<div className={styles.value}>{children}</div>
		</div>
	);
};

export default Field;
