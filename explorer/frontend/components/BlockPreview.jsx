import styles from '@/styles/components/BlockPreview.module.scss';
import ButtonClose from './ButtonClose';
import Field from './Field';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import ValueLabel from './ValueLabel';
import ValueTransactionSquares from './ValueTransactionSquares';
import { forwardRef, useEffect, useState } from 'react';
import ValueAge from './ValueAge';

const BlockPreview = ({ data, isNext, isSelected, onClose, onSelect }, ref) => {
	const { height, timestamp } = data;
	const [isTransactionSquaresRendered, setIsTransactionSquaresRendered] = useState(false);
	const [expandedStyle, setExpandedStyle] = useState('')
	const containerClassName = isSelected ? styles.blockCard : styles.blockCube;
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
			<div className={containerClassName} onClick={handleClick} ref={ref}>
				{isSelected
					? <div className="layout-flex-col">
						<ButtonClose className={styles.buttonClose} onClick={onClose} />
						<Field title="Height">
							<div className="value-highlighted">{data.height}</div>
						</Field>
						<div className="layout-grid-row">
							<Field title="Status">
								<ValueLabel text="Finalized" type="success" iconName="doublecheck" />
							</Field>
							<Field title="Timestamp">
								<ValueTimestamp value={data.timestamp} hasTime/>
							</Field>
						</div>
						<div className="layout-grid-row">
							<Field title="Total Fee">
								<ValueMosaic mosaicId="6BED913FA20223F8" amount={data.totalFee} />
							</Field>
							<Field title="Median Fee">
								<ValueMosaic mosaicId="6BED913FA20223F8" amount={data.totalFee} />
							</Field>
						</div>
						<Field title="Transaction Fees">
							{isTransactionSquaresRendered && <ValueTransactionSquares />}
						</Field>
					</div>
					: <>
						<div className={styles.age}>
							<ValueAge value={timestamp} />.
						</div>
						<div className={styles.height}>{height}</div>
						<Field title="Total Fee">
							<ValueMosaic className={styles.fee} mosaicId="6BED913FA20223F8" amount={data.totalFee} />
						</Field>
					</>
				}
			</div>
			<img className={styles.iconChain} src={iconChainSrc} />
		</div>
	);
};

export default forwardRef(BlockPreview);
