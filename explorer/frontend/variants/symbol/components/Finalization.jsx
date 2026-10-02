import styles from './Finalization.module.scss';
import { fetchFinalizationInfo } from '../api/finalization';
import Field from '@/app/components/Field';
import Progress from '@/app/components/Progress';
import Separator from '@/app/components/Separator';
import ValueAge from '@/app/components/ValueAge';
import { DATA_REFRESH_INTERVAL } from '@/app/constants';
import { useAsyncCall } from '@/app/utils';
import { useTranslation } from 'next-i18next';

// The non-numeric epoch placeholders render as an empty progress bar.
const initialFinalizationInfo = {
	chainHeight: '-',
	finalizationHeight: '-',
	currentEpoch: '-',
	nextEpoch: '-',
	epochProgress: 0,
	remainingBlocks: 0,
	epochEndEtaTimestamp: null
};

/**
 * Home page section which polls the finalization info and renders the chain and finalization heights
 * with the current epoch progress and its completion ETA. Placeholders are kept until the first data arrives.
 * @returns {JSX.Element} the finalization section content.
 */
const Finalization = () => {
	const { t } = useTranslation();
	const finalizationInfo = useAsyncCall(fetchFinalizationInfo, initialFinalizationInfo, DATA_REFRESH_INTERVAL, true)
		?? initialFinalizationInfo;
	const { chainHeight, finalizationHeight, currentEpoch, nextEpoch, epochProgress, remainingBlocks, epochEndEtaTimestamp } =
		finalizationInfo;

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
					valueLeft={currentEpoch}
					valueRight={nextEpoch}
					value={currentEpoch + epochProgress}
					size="small"
				/>
				{!!epochEndEtaTimestamp && (
					<div className={styles.eta}>
						{t('value_eta')} <ValueAge value={epochEndEtaTimestamp} />
						{' | '}
						{t('value_remainingBlocks', { count: remainingBlocks })}
					</div>
				)}
			</div>
		</div>
	);
};

export default Finalization;
