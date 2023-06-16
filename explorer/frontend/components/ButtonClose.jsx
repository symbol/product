import styles from '@/styles/components/ButtonClose.module.scss';
import Image from 'next/image';

const ButtonClose = ({ className, onClick }) => {
	return (
		<div className={`${styles.buttonClose} ${className}`} onClick={onClick}>
			<Image src="/images/icon-close.svg" fill alt="Close" />
		</div>
	);
};

export default ButtonClose;
