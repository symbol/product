import Avatar from './Avatar';
import Field from './Field';
import ValueAccount from './ValueAccount';
import ValueBlockHeight from './ValueBlockHeight';
import ValueLabel from './ValueLabel';
import ValueMosaicAliases from './ValueMosaicAliases';
import ValueMosaicAmount from './ValueMosaicAmount';
import ValueMosaicFlags from './ValueMosaicFlags';
import styles from '@/styles/components/ItemMosaicMobile.module.scss';
import { createExpirationLabel, createPageHref } from '@/utils';
import { pageConfig } from '@/variants';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const ItemMosaicMobile = ({ data, chainHeight }) => {
	const { t } = useTranslation();
	const {
		name,
		id,
		aliasNames,
		creator,
		value,
		registrationHeight,
		expirationHeight,
		namespaceExpirationHeight,
		isUnlimitedDuration
	} = data;
	const { status, text } = pageConfig.mosaics.showStatus
		? createExpirationLabel(namespaceExpirationHeight, chainHeight, isUnlimitedDuration, t)
		: {};

	return (
		<div className={styles.itemMosaicMobile}>
			<Link className={styles.mainSection} href={createPageHref('mosaics', id)}>
				<Avatar type="mosaic" size="md" value={id} />
				<div className={styles.info}>
					<div className={styles.name}>{name}</div>
					{pageConfig.mosaics.showStatus && (
						<div className="layout-flex-row">
							<ValueLabel type={status} text={text} />
						</div>
					)}
				</div>
			</Link>
			{pageConfig.mosaics.showAlias && (
				<Field title={t('table_field_alias')}>
					<ValueMosaicAliases aliases={aliasNames} />
				</Field>
			)}
			<Field title={t('field_creator')}>
				<ValueAccount address={creator} size="sm" raw={pageConfig.mosaics.showValue} />
			</Field>
			{pageConfig.mosaics.showValue && (
				<Field title={t('table_field_value')}>
					<ValueMosaicAmount value={value} />
				</Field>
			)}
			{pageConfig.mosaics.showFlags && (
				<Field title={t('table_field_flags')}>
					<ValueMosaicFlags mosaic={data} />
				</Field>
			)}
			{pageConfig.mosaics.showValue && pageConfig.mosaics.showRegistration && (
				<Field title={t('table_field_registrationHeight')}>
					<ValueBlockHeight value={registrationHeight} />
				</Field>
			)}
			{pageConfig.mosaics.showExpiration && (
				<Field title={t('table_field_expirationHeight')}>
					{expirationHeight === 0 ? 'INFINITY' : <ValueBlockHeight value={expirationHeight} />}
				</Field>
			)}
		</div>
	);
};

export default ItemMosaicMobile;
