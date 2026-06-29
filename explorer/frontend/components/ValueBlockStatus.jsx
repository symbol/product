import StatusIcon from './StatusIcon';
import ValueLabel from './ValueLabel';
import { BLOCK_STATUS } from '@/app/constants';
import { utils } from '@/app/variants/utils';
import { useTranslation } from 'next-i18next';

const statusLabelKeys = {
	[BLOCK_STATUS.PENDING]: 'label_pending',
	[BLOCK_STATUS.CREATED]: 'label_created',
	[BLOCK_STATUS.SAFE]: 'label_safe',
	[BLOCK_STATUS.FINALIZED]: 'label_finalized'
};

/**
 * Renders a block's status badge. Block finality is computed by the active variant.
 * @param {object} props - component props.
 * @param {object} props.block - the block whose status is rendered.
 * @param {object} [props.chainStatus] - current chain status ({ height, finalizedHeight }).
 * @param {boolean} [props.isIconHidden] - whether to hide the status icon.
 * @param {boolean} [props.isIconOnly] - render only the status icon (no badge/text), e.g. trailing a block height.
 * @param {string} [props.colorVariant] - colour set for the icon-only mode (see STATUS_ICON_COLOR_VARIANT).
 * @param {string} [props.className] - optional root class name.
 * @returns {JSX.Element} the status label.
 */
const ValueBlockStatus = ({ block, chainStatus, isIconHidden, isIconOnly, colorVariant, className }) => {
	const { t } = useTranslation();
	const status = utils.blocks.getBlockStatus(block, chainStatus);
	const label = t(statusLabelKeys[status]);

	if (isIconOnly)
		return <StatusIcon type={status} title={label} colorVariant={colorVariant} className={className} />;

	return <ValueLabel className={className} text={label} type={status} isIconHidden={isIconHidden} />;
};

export default ValueBlockStatus;
