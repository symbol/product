import ButtonClose from './ButtonClose';
import CustomImage from './CustomImage';
import Field from './Field';
import FieldTimestamp from './FieldTimestamp';
import ValueAge from './ValueAge';
import ValueLabel from './ValueLabel';
import ValueMosaic from './ValueMosaic';
import ValueTransactionSquares from './ValueTransactionSquares';
import styles from '@/styles/components/BlockPreview.module.scss';
import { createPageHref } from '@/utils';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { forwardRef, useEffect, useState } from 'react';

const BlockExpanded = ({ data, transactions, isNext, isTransactionSquaresRendered, onClose }) => {
	const { height, timestamp, totalFee, averageFee } = data;
	const { t } = useTranslation();
	const href = createPageHref('blocks', height);

	return (
		<div className="layout-flex-col-fields">
			<ButtonClose className={styles.buttonClose} onClick={onClose} />
			<Link href={href} className={styles.buttonMore} target="_blank">
				<CustomImage className={styles.buttonMoreIcon} src="/images/icon-circle-more.png" alt="more" />
			</Link>
			<Field title={t('field_height')}>
				<div className="value-highlighted">{height}</div>
			</Field>
			<div className="layout-grid-row">
				<Field title={t('field_status')}>
					{isNext && <ValueLabel text={t('label_pending')} type="pending" />}
					{!isNext && <ValueLabel text={t('label_created')} type="created" />}
				</Field>
				<FieldTimestamp value={timestamp} hasTime hasSeconds />
			</div>
			<div className="layout-grid-row">
				<Field title={t('field_totalFee')}>
					<ValueMosaic isNative amount={totalFee} />
				</Field>
			</div>
			<Field title={t('field_transactionFees')}>
				{isTransactionSquaresRendered && <ValueTransactionSquares data={transactions} />}
			</Field>
		</div>
	);
};

const BlockCube = ({ data }) => {
	const { height, timestamp, transactionCount, totalFee } = data;
	const { t } = useTranslation();

	return (
		<>
			<div className={styles.age}>
				<ValueAge value={timestamp} />.
			</div>
			<div className={styles.middle}>
				<div className={styles.height}>{height}</div>
				<div>{transactionCount} TXs.</div>
			</div>
			<Field title={t('field_totalFee')}>
				<ValueMosaic className={styles.fee} isNative amount={totalFee} />
			</Field>
		</>
	);
};

const BlockPreview = ({ data, transactions, isNext, isSelected, onClose, onSelect, smallBoxRef, bigBoxRef }) => {
	const { height } = data;
	const [isTransactionSquaresRendered, setIsTransactionSquaresRendered] = useState(false);
	const [expandedStyle, setExpandedStyle] = useState('');
	const cubeClassName = isNext ? styles.blockCubeNext : styles.blockCube;
	const containerClassName = isSelected ? styles.blockCard : cubeClassName;
	const iconChainSrc = isNext ? '/images/icon-chain-pending.svg' : '/images/icon-chain.svg';

	const handleClick = () => {
		if (!isSelected) {
			onSelect(height);
		}
	};

	useEffect(() => {
		setIsTransactionSquaresRendered(false);
		setTimeout(() => setIsTransactionSquaresRendered(true), 250);

		if (isSelected) {
			setExpandedStyle(styles.blockPreview_expanded);
		} else {
			setTimeout(() => {
				setExpandedStyle('');
			}, 300);
		}
	}, [data, isSelected]);

	return (
		<div className={`${styles.blockPreview} ${expandedStyle}`}>
			<div className={styles.bigBox} ref={bigBoxRef} />
			<div className={styles.smallBox} ref={smallBoxRef} />
			<div className={containerClassName} onClick={handleClick}>
				{isSelected ? (
					<BlockExpanded
						data={data}
						transactions={transactions}
						isTransactionSquaresRendered={isTransactionSquaresRendered}
						onClose={onClose}
					/>
				) : (
					<BlockCube data={data} isNext={isNext} />
				)}
			</div>
			<CustomImage className={styles.iconChain} src={iconChainSrc} />
		</div>
	);
};

export default forwardRef(BlockPreview);
