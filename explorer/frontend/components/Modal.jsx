import Card from './Card';
import styles from '@/styles/components/Modal.module.scss';

const Modal = ({ children, className, isVisible, onClick, onClose }) => {
	const handleCardClick = e => {
		e.stopPropagation();
		if (onClick) {
			onClick();
		}
	};

	return isVisible ? (
		<div className={styles.overlay} onClick={onClose}>
			<Card className={`${styles.modal} ${className}`} onClick={handleCardClick}>
				{children}
			</Card>
		</div>
	) : null;
};

export default Modal;
