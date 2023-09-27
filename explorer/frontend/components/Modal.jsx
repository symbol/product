import { useEffect } from 'react';
import Card from './Card';
import styles from '@/styles/components/Modal.module.scss';

const Modal = ({ children, className, isVisible, onClick, onClose }) => {
	const handleCardClick = e => {
		e.stopPropagation();
		if (onClick) {
			onClick();
		}
	};

	useEffect(() => {
		if (isVisible) {
			document.body.classList.add('disable-scroll');
		}
		else {
			document.body.classList.remove('disable-scroll');
		}
	}, [isVisible])

	return isVisible ? (
		<div className={styles.overlay} onClick={onClose}>
			<Card className={`${styles.modal} ${className}`} onClick={handleCardClick}>
				{children}
			</Card>
		</div>
	) : null;
};

export default Modal;
