import Card from './Card';
import styles from '@/styles/components/Section.module.scss';

const Section = ({ children, title }) => (
	<div className={styles.section}>
		<h3>{title}</h3>
		<Card>{children}</Card>
	</div>
);

export default Section;
