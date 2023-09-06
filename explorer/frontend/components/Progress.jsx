import Field from './Field';
import styles from '@/styles/components/Progress.module.scss';

const Progress = ({ titleLeft, titleRight, valueLeft, valueRight, value, className, onClick }) => {
	const progressPercentage = ((value - valueLeft) * 100) / (valueRight - valueLeft);
	const progressStyle = {
		width: `${progressPercentage < 0 ? 0 : progressPercentage}%`
	};

	return (
		<div className={className} onClick={onClick}>
			<div className={styles.fields}>
				<Field title={titleLeft}>{valueLeft}</Field>

				<Field title={titleRight} textAlign="right">
					{valueRight}
				</Field>
			</div>
			<div className={styles.progress}>
				<div className={styles.progressInner} style={progressStyle} />
			</div>
		</div>
	);
};

export default Progress;
