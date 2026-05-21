import CustomImage from './CustomImage';
import styles from '@/styles/components/ValueMosaicFlags.module.scss';
import { useTranslation } from 'next-i18next';

const MOSAIC_FLAG_ICONS = [
	{
		key: 'isSupplyMutable',
		src: '/images/mosaics/property-supply-mutable.svg',
		alt: 'Supply mutable',
		tooltipKey: 'tooltip_mosaicFlagSupplyMutable'
	},
	{
		key: 'isTransferable',
		src: '/images/mosaics/property-transferable.svg',
		alt: 'Transferable',
		tooltipKey: 'tooltip_mosaicFlagTransferable'
	},
	{
		key: 'isRestrictable',
		src: '/images/mosaics/property-restricable.svg',
		alt: 'Restrictable',
		tooltipKey: 'tooltip_mosaicFlagRestrictable'
	},
	{
		key: 'isRevokable',
		src: '/images/mosaics/property-revokable.svg',
		alt: 'Revokable',
		tooltipKey: 'tooltip_mosaicFlagRevokable'
	}
];

const ValueMosaicFlags = ({ mosaic }) => {
	const { t } = useTranslation();

	return (
		<div className={styles.valueMosaicFlags}>
			{MOSAIC_FLAG_ICONS
				.filter(item => mosaic[item.key])
				.map(item => (
					<span key={item.key} className={styles.tooltip} title={t(item.tooltipKey)}>
						<CustomImage src={item.src} alt={item.alt} className={styles.icon} />
					</span>
				))}
		</div>
	);
};

export default ValueMosaicFlags;
