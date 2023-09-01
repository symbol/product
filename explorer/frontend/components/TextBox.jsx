import CustomImage from './CustomImage';
import styles from '@/styles/components/TextBox.module.scss';

const TextBox = ({ iconSrc, placeholder, value, className, onChange }) => {
	return (
		<div className={`${styles.textBox} ${className}`}>
			{!!iconSrc && <CustomImage src={iconSrc} className={styles.icon} />}
			<input placeholder={placeholder} value={value} onChange={e => onChange(e.target.value.trim())} className={styles.input} />
		</div>
	);
};

export default TextBox;
