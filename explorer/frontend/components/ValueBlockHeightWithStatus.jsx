import ValueBlockHeight from './ValueBlockHeight';
import ValueBlockStatus from './ValueBlockStatus';
import { STATUS_ICON_COLOR_VARIANT } from '@/app/constants';
import styles from '@/app/styles/components/ValueBlockHeightWithStatus.module.scss';

/**
 * Renders a block height followed by its finality status icon.
 * @param {object} props - component props.
 * @param {object} props.block - the block, providing both the height and the status inputs.
 * @param {object} [props.chainStatus] - current chain status ({ height, finalizedHeight }).
 * @param {string} [props.className] - optional root class name.
 * @returns {JSX.Element} the height with a trailing status icon.
 */
const ValueBlockHeightWithStatus = ({ block, chainStatus, className }) => (
	<div className={`${styles.valueBlockHeightWithStatus} ${className || ''}`}>
		<ValueBlockHeight value={block.height} />
		<ValueBlockStatus block={block} chainStatus={chainStatus} isIconOnly colorVariant={STATUS_ICON_COLOR_VARIANT.BODY} />
	</div>
);

export default ValueBlockHeightWithStatus;
