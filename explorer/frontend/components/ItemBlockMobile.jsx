import Avatar from './Avatar';
import CustomImage from './CustomImage';
import Field from './Field';
import ValueAccount from './ValueAccount';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import styles from '@/styles/components/ItemBlockMobile.module.scss';
import { createPageHref } from '@/utils';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const ItemBlockMobile = ({ data, isFinalizationShown, isStatementCountShown, isBlockRewardShown }) => {
	const { t } = useTranslation();
	const { height, harvester, timestamp, totalFee, transactionCount, isFinalized, statementCount, blockReward } = data;

	return (
		<div className={styles.itemBlockMobile}>
			<Link className={styles.mainSection} href={createPageHref('blocks', height)}>
				<Avatar type="block" size="md" value={height} />
				<div className={styles.info}>
					<div className={styles.name}>
						{height}
						{!!isFinalizationShown && (
							<CustomImage
								className={styles.finalizationIcon}
								src={`/symbol/images/blocks/finalization-${isFinalized ? 'finalized' : 'pending'}.svg`}
								alt={isFinalized ? 'Finalized block' : 'Unfinalized block'}
							/>
						)}
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
			<Field title={t('table_field_transactionCount')}>{transactionCount}</Field>
			{!!isStatementCountShown && <Field title={t('table_field_statementCount')}>{statementCount}</Field>}
			{!!isBlockRewardShown && (
				<Field title={t('table_field_blockReward')}>
					<ValueMosaic isNative amount={blockReward} />
				</Field>
			)}
		</div>
	);
};

export default ItemBlockMobile;
