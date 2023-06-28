import Card from './Card';
import styles from '@/styles/components/Section.module.scss';

const Section = ({ children, title, className, cardClassName }) => (
	<div className={`${styles.section} ${className}`}>
		<h3>{title}</h3>
		<Card className={cardClassName}>{children}</Card>
	</div>
);

export default Section;
