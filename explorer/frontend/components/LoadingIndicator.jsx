import styles from '@/styles/components/LoadingIndicator.module.scss';

const LoadingIndicator = ({ className }) => (
	<svg className={`${styles.spinner} ${className}`} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
		<circle className={styles.path} fill="none" cx="40" cy="40" r="30" strokeWidth="8"></circle>
	</svg>
);

export default LoadingIndicator;
