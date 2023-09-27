import ButtonClose from './ButtonClose';
import Modal from './Modal';
import styles from '@/styles/components/ValueList.module.scss';
import { arrayToText, useToggle } from '@/utils';
import { useTranslation } from 'next-i18next';

const ValueList = ({ className, data, direction, max, title }) => {
	const { t } = useTranslation();
	const [isMenuOpen, toggleMenu] = useToggle(false);
	const isColumn = direction === 'col';
	const directionStyle = isColumn ? styles.listColumn : styles.listRow;
	const slicedList = data.slice(0, max);
	const remainingItemCount = data.length - slicedList.length;
	const isButtonMoreShown = remainingItemCount > 0;

	const renderColumn = data => data.map((item, index) => <div key={index}>{item}</div>);

	return (
		<div className={`${directionStyle} ${className}`}>
			{isColumn && renderColumn(slicedList)}
			{!isColumn && arrayToText(slicedList)}
			{isButtonMoreShown && (
				<div className={styles.buttonMore} onClick={toggleMenu}>
					{t('button_more', { count: remainingItemCount })}
				</div>
			)}
			<Modal className={styles.modal} isVisible={isMenuOpen} onClose={toggleMenu}>
				<h4>{title}</h4>
				<div className={styles.modalContent}>{renderColumn(data)}</div>
				<ButtonClose className={styles.buttonClose} onClick={toggleMenu} />
			</Modal>
		</div>
	);
};

export default ValueList;
