import styles from '@/styles/components/Card.module.scss';

const Card = ({ children }) => <div className={styles.card}>{children}</div>;

export default Card;
