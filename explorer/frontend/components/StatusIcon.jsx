import CustomImage from './CustomImage';
import { STATUS_ICON_COLOR_VARIANT } from '@/app/constants';
import styles from '@/app/styles/components/StatusIcon.module.scss';
import { createAssetURL } from '@/app/utils';

const iconShapeMap = {
	created: 'true',
	safe: 'confirmed',
	confirmed: 'confirmed',
	finalized: 'confirmed',
	true: 'true',
	active: 'true',
	pending: 'pending',
	false: 'false',
	inactive: 'false',
	harvesting: 'harvesting',
	multisig: 'multisig'
};

/**
 * Renders a bare status/label icon.
 * @param {object} props - component props.
 * @param {string} props.type - status/label token selecting the icon shape.
 * @param {string} [props.colorVariant] - colour set to render the icon in; defaults to the semantic palette.
 * @param {string} [props.title] - localized label; used as the tooltip and the image alt text.
 * @param {string} [props.className] - optional class name (e.g. a color modifier).
 * @param {object} [props.style] - optional inline style.
 * @returns {JSX.Element} the icon.
 */
const StatusIcon = ({ type, colorVariant = STATUS_ICON_COLOR_VARIANT.SEMANTIC, title, className, style }) => (
	<CustomImage
		src={createAssetURL(`/images/status/${colorVariant}/icon-label-${iconShapeMap[type]}.svg`)}
		className={`${styles.statusIcon} ${className || ''}`}
		style={style}
		alt={title || type}
		title={title}
	/>
);

export default StatusIcon;
