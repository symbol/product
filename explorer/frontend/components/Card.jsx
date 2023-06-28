import styles from '@/styles/components/Card.module.scss';

const Card = ({ children, className }) => <div className={`${styles.card} ${className}`}>{children}</div>;

export default Card;
