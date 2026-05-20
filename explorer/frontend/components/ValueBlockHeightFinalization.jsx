import CustomImage from './CustomImage';
import ValueBlockHeight from './ValueBlockHeight';
import styles from '@/styles/components/ValueBlockHeightFinalization.module.scss';

const ValueBlockHeightFinalization = ({ value, isFinalized }) => (
	<div className={styles.valueBlockHeightFinalization}>
		<ValueBlockHeight value={value} />
		<CustomImage
			className={styles.icon}
			src={`/symbol/images/blocks/finalization-${isFinalized ? 'finalized' : 'pending'}.svg`}
			alt={isFinalized ? 'Finalized block' : 'Unfinalized block'}
		/>
	</div>
);

export default ValueBlockHeightFinalization;
