import ButtonClose from './ButtonClose';
import CustomImage from './CustomImage';
import Field from './Field';
import FieldTimestamp from './FieldTimestamp';
import ValueAge from './ValueAge';
import ValueBlockStatus from './ValueBlockStatus';
import ValueMosaic from './ValueMosaic';
import ValueTransactionSquares from './ValueTransactionSquares';
import styles from '@/app/styles/components/BlockPreview.module.scss';
import { createAssetURL } from '@/app/utils';
import { createPageHref } from '@/app/utils';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { useEffect, useState } from 'react';

const BlockExpanded = ({ data, transactions, chainStatus, isTransactionSquaresRendered, onClose }) => {
	const { height, timestamp, totalFee, transactionCount } = data;
	const { t } = useTranslation();
	const href = createPageHref('blocks', height);

	return (
		<div className="layout-flex-col-fields">
			<ButtonClose className={styles.buttonClose} onClick={onClose} />
			<Link href={href} className={styles.buttonMore} target="_blank">
				<CustomImage className={styles.buttonMoreIcon} src={createAssetURL('/images/icon-circle-more.png')} alt="More" />
			</Link>
			<Field title={t('field_height')}>
				<div className="value-highlighted">{height}</div>
			</Field>
			<div className="layout-grid-row">
				<Field title={t('field_status')}>
					<ValueBlockStatus block={data} chainStatus={chainStatus} />
				</Field>
				<FieldTimestamp value={timestamp} hasTime hasSeconds />
			</div>
			<div className="layout-grid-row">
				<Field title={t('field_totalFee')}>
					<ValueMosaic isNative amount={totalFee} />
				</Field>
			</div>
			<Field title={t('field_transactionFees')}>
				{isTransactionSquaresRendered && <ValueTransactionSquares data={transactions} transactionCount={transactionCount} />}
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

const BlockPreview = ({ data, transactions, isNext, chainStatus, isSelected, onClose, onSelect, smallBoxRef, bigBoxRef }) => {
	const { height } = data;
	const [isTransactionSquaresRendered, setIsTransactionSquaresRendered] = useState(false);
	const [expandedStyle, setExpandedStyle] = useState('');
	const cubeClassName = isNext ? styles.blockCubeNext : styles.blockCube;
	const containerClassName = isSelected ? styles.blockCard : cubeClassName;
	const iconChainSrc = isNext ? createAssetURL('/images/icon-chain-pending.svg') : createAssetURL('/images/icon-chain.svg');

	const handleClick = () => {
		if (!isSelected) 
			onSelect(height);
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
						chainStatus={chainStatus}
						isTransactionSquaresRendered={isTransactionSquaresRendered}
						onClose={onClose}
					/>
				) : (
					<BlockCube data={data} isNext={isNext} />
				)}
			</div>
			<CustomImage className={styles.iconChain} src={iconChainSrc} alt="Chain icon" />
		</div>
	);
};

export default BlockPreview;
