import styles from '@/styles/components/Card.module.scss';

const Card = ({ children, className, onClick }) => <div className={`${styles.card} ${className}`} onClick={onClick}>{children}</div>;

export default Card;
