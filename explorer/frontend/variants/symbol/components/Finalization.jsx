import styles from './Finalization.module.scss';
import { fetchFinalizationInfo } from '../api/finalization';
import Field from '@/components/Field';
import Progress from '@/components/Progress';
import Separator from '@/components/Separator';
import ValueAge from '@/components/ValueAge';
import { useAsyncCall } from '@/utils';
import { useTranslation } from 'next-i18next';

const DATA_REFRESH_INTERVAL = 15000;

const Finalization = () => {
	const { t } = useTranslation();
	const initialData = {
		chainHeight: '-',
		finalizationHeight: 0,
		previousEpochHeight: 0,
		currentEpochHeight: 1,
		remainingBlocks: 0,
		epochStart: '-',
		epochEnd: '-',
		epochEndEtaTimestamp: 0
	};
	const finalizationInfo = useAsyncCall(fetchFinalizationInfo, initialData, DATA_REFRESH_INTERVAL);
	const {
		chainHeight,
		finalizationHeight,
		previousEpochHeight,
		currentEpochHeight,
		epochStart,
		epochEnd,
		epochEndEtaTimestamp,
		remainingBlocks
	} = finalizationInfo;
	const percentCompleted = currentEpochHeight === previousEpochHeight
		? 0
		: ((finalizationHeight - previousEpochHeight) * 100) / (currentEpochHeight - previousEpochHeight);

	return (
		<div className="layout-flex-row-mobile-col">
			<div className={styles.sectionHeight}>
				<Field title={t('field_chainHeight')}>{chainHeight}</Field>
				<Field title={t('field_finalizationHeight')} textAlign="right">
					{finalizationHeight}
				</Field>
			</div>
			<Separator className="no-mobile" />
			<div className={styles.sectionEpoch}>
				<Progress
					titleLeft={t('field_epoch')}
					valueLeft={epochStart}
					valueRight={epochEnd}
					progress={percentCompleted}
					size="small"
				/>
				<div className={styles.eta}>
					{t('value_eta')} <ValueAge value={epochEndEtaTimestamp} /> | {t('value_remainingBlocks', { remainingBlocks })}
				</div>
			</div>
		</div>
	);
};

export default Finalization;
