import Field from '@/app/components/Field';
import ValueCopy from '@/app/components/ValueCopy';
import ValueMosaic from '@/app/components/ValueMosaic';
import { numberToString } from '@/app/utils';
import { useTranslation } from 'next-i18next';

const BlockImportance = ({ blockInfo }) => {
	const { t } = useTranslation();

	return (
		<>
			<h3>{t('section_blockImportance')}</h3>
			<div className="layout-flex-col-fields">
				<Field title={t('field_votingEligibleAccountsCount')}>
					{numberToString(blockInfo.votingEligibleAccountsCount)}
				</Field>
				<Field title={t('field_harvestingEligibleAccountsCount')}>
					{numberToString(blockInfo.harvestingEligibleAccountsCount)}
				</Field>
				<Field title={t('field_totalVotingBalance')}>
					<ValueMosaic isNative isTickerShown amount={blockInfo.totalVotingBalance} />
				</Field>
				<Field title={t('field_previousImportanceBlockHash')}>
					<ValueCopy value={blockInfo.previousImportanceBlockHash} />
				</Field>
			</div>
		</>
	);
};

BlockImportance.isVisible = ({ blockInfo }) => ['importance', 'nemesis'].includes(blockInfo.blockType);

export default BlockImportance;
