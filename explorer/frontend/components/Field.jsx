import CustomImage from './CustomImage';
import styles from '@/styles/components/Field.module.scss';

const textAlignStyleMap = {
	right: styles.textAlignRight
};

const Field = ({ className, titleClassName, title, description, children, textAlign, iconSrc, onTitleClick }) => {
	const textAlignStyle = textAlignStyleMap[textAlign];

	return (
		<div className={`${styles.field} ${textAlignStyle} ${className}`}>
			<div className={`${styles.title} ${titleClassName}`} onClick={onTitleClick}>
				{title}
				{!!description && (
					<div className={styles.tooltip}>
						<CustomImage src="/images/icon-question.svg" className={styles.tooltipIcon} />
						<div className={styles.tooltipContent}>{description}</div>
					</div>
				)}
				{!!iconSrc && <CustomImage src={iconSrc} className={styles.icon} />}
			</div>
			<div className={styles.value}>{children}</div>
		</div>
	);
};

export default Field;
