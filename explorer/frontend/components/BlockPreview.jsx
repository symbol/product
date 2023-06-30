import styles from '@/styles/components/BlockPreview.module.scss';
import ButtonClose from './ButtonClose';
import Field from './Field';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import ValueLabel from './ValueLabel';
import ValueTransactionSquares from './ValueTransactionSquares';
import { forwardRef, useEffect, useState } from 'react';
import ValueAge from './ValueAge';
import CustomImage from './CustomImage';

const BlockExpanded = ({ data, isNext, isTransactionSquaresRendered, onClose }) => {
	const { height, timestamp, transactionFees, totalFee, medianFee} = data;

	return (
		<div className="layout-flex-col">
			<ButtonClose className={styles.buttonClose} onClick={onClose} />
			<Field title="Height">
				<div className="value-highlighted">{height}</div>
			</Field>
			<div className="layout-grid-row">
				<Field title="Status">
					{isNext && <ValueLabel text="Pending" type="warning" iconName="pending" />}
					{!isNext && <ValueLabel text="Safe" type="success" iconName="doublecheck" />}
				</Field>
				<Field title="Timestamp">
					{!isNext && <ValueTimestamp value={timestamp} hasTime hasSeconds />}
				</Field>
			</div>
			<div className="layout-grid-row">
				<Field title="Total Fee">
					<ValueMosaic isNative amount={totalFee} />
				</Field>
				<Field title="Median Fee">
					<ValueMosaic isNative amount={medianFee} />
				</Field>
			</div>
			<Field title="Transaction Fees">
				{isTransactionSquaresRendered && <ValueTransactionSquares data={transactionFees} />}
			</Field>
		</div>
	)
}

const BlockCube = ({ data, isNext }) => {
	const { height, timestamp, transactionCount, totalFee} = data;

	return (
		<>
			<div className={styles.age}>
				<ValueAge value={timestamp} />.
			</div>
			<div className={styles.middle}>
				<div className={styles.height}>{height}</div>
				<div>{transactionCount} TXs.</div>
			</div>
			<Field title="Total Fee">
				<ValueMosaic className={styles.fee} isNative amount={totalFee} />
			</Field>
		</>
	);
};

const BlockPreview = ({ data, isNext, isSelected, onClose, onSelect, smallBoxRef, bigBoxRef }) => {
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
		}
		else {
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
				{isSelected
					? <BlockExpanded
						data={data}
						isTransactionSquaresRendered={isTransactionSquaresRendered}
						onClose={onClose}
					/>
					: <BlockCube data={data} isNext={isNext} />
				}
			</div>
			<CustomImage className={styles.iconChain} src={iconChainSrc} />
		</div>
	);
};

export default forwardRef(BlockPreview);
