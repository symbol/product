import Avatar from './Avatar';
import Field from './Field';
import ValueAccount from './ValueAccount';
import ValueBlockStatus from './ValueBlockStatus';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import { STATUS_ICON_COLOR_VARIANT } from '@/app/constants';
import styles from '@/app/styles/components/ItemBlockMobile.module.scss';
import { createPageHref, nullableValueToText } from '@/app/utils';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const ItemBlockMobile = ({
	data,
	chainStatus,
	isTransactionCountShown,
	isStatementCountShown,
	isBlockRewardShown
}) => {
	const { t } = useTranslation();
	const { height, harvester, timestamp, totalFee, transactionCount, statementCount, blockReward } = data;
	const renderMosaicValue = value => value === null || value === undefined
		? nullableValueToText(value)
		: <ValueMosaic isNative amount={value} />;

	return (
		<div className={styles.itemBlockMobile}>
			<Link className={styles.mainSection} href={createPageHref('blocks', height)}>
				<Avatar type="block" size="md" value={height} />
				<div className={styles.info}>
					<div className={styles.name}>
						{height}
						<ValueBlockStatus
							block={data}
							chainStatus={chainStatus}
							isIconOnly 
							colorVariant={STATUS_ICON_COLOR_VARIANT.LINK} 
						/>
					</div>
					<div className="layout-flex-row">
						<ValueTimestamp className={styles.timestamp} value={timestamp} hasTime />
						<ValueMosaic isNative amount={totalFee} />
					</div>
				</div>
			</Link>
			<Field title={t('field_creator')}>
				<ValueAccount address={harvester} size="sm" />
			</Field>
			{!!isTransactionCountShown && <Field title={t('table_field_transactionCount')}>{transactionCount}</Field>}
			{!!isStatementCountShown && <Field title={t('table_field_statementCount')}>{statementCount}</Field>}
			{!!isBlockRewardShown && <Field title={t('table_field_blockReward')}>{renderMosaicValue(blockReward)}</Field>}
		</div>
	);
};

export default ItemBlockMobile;
