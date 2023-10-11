import { fetchBlockInfo } from '@/api/blocks';
import { fetchTransactionPage } from '@/api/transactions';
import Field from '@/components/Field';
import FieldTimestamp from '@/components/FieldTimestamp';
import ItemTransactionMobile from '@/components/ItemTransactionMobile';
import Section from '@/components/Section';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueCopy from '@/components/ValueCopy';
import ValueLabel from '@/components/ValueLabel';
import ValueList from '@/components/ValueList';
import ValueMosaic from '@/components/ValueMosaic';
import ValueTransactionHash from '@/components/ValueTransactionHash';
import ValueTransactionSquares from '@/components/ValueTransactionSquares';
import ValueTransactionType from '@/components/ValueTransactionType';
import styles from '@/styles/pages/BlockInfo.module.scss';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale, params }) => {
	const blockInfo = await fetchBlockInfo(params.height);

	if (!blockInfo) {
		return {
			notFound: true
		};
	}

	const transactionsPage = await fetchTransactionPage({ pageSize: blockInfo.transactionCount }, { height: params.height });

	return {
		props: {
			blockInfo,
			transactions: transactionsPage.data,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const BlockInfo = ({ blockInfo, transactions }) => {
	const { t } = useTranslation();

	const tableColumns = [
		{
			key: 'hash',
			size: '8rem',
			renderValue: value => <ValueTransactionHash value={value} />
		},
		{
			key: 'type',
			size: '9rem',
			renderValue: value => <ValueTransactionType value={value} />
		},
		{
			key: 'sender',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'recipient',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'value',
			size: '20rem',
			renderValue: value => (
				<ValueList
					data={value}
					max={2}
					direction="column"
					renderItem={item => <ValueMosaic mosaicId={item.id} mosaicName={item.name} amount={item.amount} isTickerShown />}
				/>
			)
		},
		{
			key: 'fee',
			size: '7rem',
			renderValue: value => <ValueMosaic amount={value} isNative hasTime />
		}
	];

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_blockInfo', { height: blockInfo.height })}</title>
			</Head>
			<div className="layout-section-row">
				<Section title={t('section_block')} className={styles.firstSection} cardClassName={styles.firstSectionCard}>
					<div className="layout-flex-col-fields">
						<Field title={t('field_height')} description={t('field_height_description')}>
							<div className="value-highlighted">{blockInfo.height}</div>
						</Field>
						<div className="layout-grid-row">
							<Field title={t('field_status')}>
								{!blockInfo.isSafe && <ValueLabel text={t('label_created')} type="created" />}
								{blockInfo.isSafe && <ValueLabel text={t('label_safe')} type="safe" />}
							</Field>
							<FieldTimestamp value={blockInfo.timestamp} hasTime hasSeconds />
						</div>
						<div className="layout-grid-row">
							<Field title={t('field_totalFee')} description={t('field_totalFee_description')}>
								<ValueMosaic isNative amount={blockInfo.totalFee} />
							</Field>
							<Field title={t('field_averageFee')}>
								<ValueMosaic isNative amount={blockInfo.averageFee} />
							</Field>
						</div>
						<Field title={t('field_transactionFees')}>
							<ValueTransactionSquares data={transactions} className={styles.valueTransactionSquares} />
						</Field>
					</div>
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<div className="layout-flex-col-fields">
						<Field title={t('field_harvester')} description={t('field_harvester_description')}>
							<ValueAccount address={blockInfo.harvester} size="sm" />
						</Field>
						<Field title={t('field_transactions')}>{blockInfo.transactionCount}</Field>
						<Field title={t('field_size')}>{blockInfo.size} B</Field>
						<Field title={t('field_difficulty')}>{blockInfo.difficulty} %</Field>
						<Field title={t('field_signature')}>
							<ValueCopy value={blockInfo.signature} />
						</Field>
						<Field title={t('field_hash')}>
							<ValueCopy value={blockInfo.hash} />
						</Field>
					</div>
				</Section>
			</div>
			<Section title={t('section_transactions')}>
				<Table
					data={transactions}
					columns={tableColumns}
					renderItemMobile={data => <ItemTransactionMobile data={data} />}
					isLastPage={true}
				/>
			</Section>
		</div>
	);
};

export default BlockInfo;
