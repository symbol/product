import styles from '@/styles/components/Field.module.scss';

const Text = ({ type, className, children }) => {
	const typeStyleMap = {
		highlighted: styles.valueHighlighted
	};

	return <div className={`${typeStyleMap[type]} ${className}`}></div>;
};

export default Text;
