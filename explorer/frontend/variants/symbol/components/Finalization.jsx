import Field from '@/components/Field';
import styles from './Finalization.module.scss';
import Separator from '@/components/Separator';
import { useTranslation } from 'next-i18next';
import Progress from '@/components/Progress';
import ValueAge from '@/components/ValueAge';
import { useAsyncCall } from '@/utils';
import { fetchFinalizationInfo } from '@/_variants/symbol/api/finalization';

export default () => {
    const { t } = useTranslation();

    const initialData = {
        chainHeight: '-',
        finalizationHeight: 1,
        previousEpochHeight: 0,
        currentEpochHeight: 1000,
        remainingBlocks: 0,
        epochStart: '-',
        epochEnd: '-',
        epochEndEtaTimestamp: 0 
    };
    const finalizationInfo = useAsyncCall(fetchFinalizationInfo, initialData, 15000);
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
    const percentCompleted = ((finalizationHeight - previousEpochHeight) * 100) / (currentEpochHeight - previousEpochHeight);

    const textRemainingBlocks = t('value_remainingBlocks', { remainingBlocks });
    const textEta = t('value_eta');

    return (
        <div className="layout-flex-row-mobile-col">
            <div className={styles.sectionHeight}>
                <Field title={t('field_chainHeight')}>
                    {chainHeight}
                </Field>
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
                    {textEta} <ValueAge value={epochEndEtaTimestamp} /> | {textRemainingBlocks}
                </div>
            </div>
        </div>
    );

    return (
        <div className="layout-flex-row-mobile-col">
            <div className="layout-flex-row layout-flex-fill">
                <Field title={t('field_chainHeight')}>
                    {chainHeight}
                </Field>
                <Field title={t('field_finalizationHeight')} textAlign="right">
                    {finalizationHeight}
                </Field>
            </div>
            <Separator className="no-mobile" />
            <div className="layout-flex-fill">
                <Progress
                    titleLeft={t('field_epochStart')}
                    titleRight={t('field_epochEnd')}
                    valueLeft={epochStart}
                    valueRight={epochEnd}
                    progress={percentCompleted}
                    size="small"
                />
                <div className={styles.eta}>
                    ETA <ValueAge value={epochEndEtaSeconds} />
                </div>
            </div>
        </div>
    );
    
    return (
        <div className="layout-flex-row-mobile-col">
            <div className="layout-flex-col layout-flex-fill">
                <Field title={t('field_chainHeight')}>
                    {chainHeight}
                </Field>
                <Field title={t('field_finalizationHeight')}>
                    {finalizationHeight}
                </Field>
            </div>
            <div className="layout-flex-fill">
                <Progress
                    titleLeft={t('field_epochStart')}
                    titleRight={t('field_epochEnd')}
                    valueLeft={epochStart}
                    valueRight={epochEnd}
                    progress={percentCompleted}
                    size="big"
                />
                <div className={styles.eta}>
                    ETA <ValueAge value={epochEndEtaSeconds} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="layout-flex-row-mobile-col">
            <div className="layout-grid-row layout-flex-fill">
                <div className="layout-flex-col layout-flex-fill">
                    <Field title={t('field_chainHeight')}>
                        {chainHeight}
                    </Field>
                </div>
            </div>
            <Separator className="no-mobile" />
            <div className="layout-grid-row layout-flex-fill">
                <div className="layout-flex-col layout-flex-fill">
                    <Field title={t('field_finalizationHeight')}>
                        {finalizationHeight}
                    </Field>
                </div>
            </div>
            <Separator className="no-mobile" />
            <div className="layout-grid-row layout-flex-fill">
                <Progress
                    titleLeft={t('field_epochStart')}
                    titleRight={t('field_epochEnd')}
                    valueLeft={epochStart}
                    valueRight={epochEnd}
                    progress={percentCompleted}
                    size="small"
                />
            </div>
        </div>
    );
}
