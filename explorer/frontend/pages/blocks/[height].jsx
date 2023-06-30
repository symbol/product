import { fetchTransactionPage, getTransactionPage } from '../api/transactions';
import Field from '@/components/Field';
import ItemTransactionMobile from '@/components/ItemTransactionMobile';
import Section from '@/components/Section';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueCopy from '@/components/ValueCopy';
import ValueLabel from '@/components/ValueLabel';
import ValueMosaic from '@/components/ValueMosaic';
import ValueTimestamp from '@/components/ValueTimestamp';
import ValueTransactionHash from '@/components/ValueTransactionHash';
import ValueTransactionSquares from '@/components/ValueTransactionSquares';
import ValueTransactionType from '@/components/ValueTransactionType';
import { getBlockInfo } from '@/pages/api/blocks';
import styles from '@/styles/pages/BlockInfo.module.scss';
import { usePagination } from '@/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale, params }) => {
	const blockInfo = await getBlockInfo(params.height);
	const transactionsPage = await getTransactionPage({ pageSize: blockInfo.transactionCount });

	if (!blockInfo) {
		return {
			notFound: true
		};
	}

	return {
		props: {
			blockInfo,
			transactions: transactionsPage.data,
			...(await serverSideTranslations(locale, ['common', 'blocks']))
		}
	};
};

const Blocks = ({ blockInfo, transactions }) => {
	const { t } = useTranslation('blocks');
	// const [loadTransactionPage, transactionList, isLoading, pageNumber, isLastPage] = usePagination(
	//     fetchTransactionPage,
	//     transactions,
	// );

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
			key: 'signer',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'recipient',
			size: '20rem',
			renderValue: value => <ValueAccount address={value} size="md" />
		},
		{
			key: 'amount',
			size: '10rem',
			renderValue: value => <ValueMosaic amount={value} isNative hasTime />
		},
		{
			key: 'fee',
			size: '7rem',
			renderValue: value => <ValueMosaic amount={value} isNative hasTime />
		},
		{
			key: 'height',
			size: '6rem'
		},
		{
			key: 'timestamp',
			size: '10rem',
			renderValue: value => <ValueTimestamp value={value} hasTime />
		}
	];

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_block')}</title>
			</Head>
			<div className="layout-section-row">
				<Section title={t('section_block')} className={styles.firstSection} cardClassName={styles.firstSectionCard}>
					<div className="layout-flex-col">
						<Field title="Height">
							<div className="value-highlighted">{blockInfo.height}</div>
						</Field>
						<div className="layout-grid-row">
							<Field title="Status">
								<ValueLabel text="Safe" type="success" iconName="doublecheck" />
							</Field>
							<Field title="Timestamp">
								<ValueTimestamp value={blockInfo.timestamp} hasTime />
							</Field>
						</div>
						<div className="layout-grid-row">
							<Field title="Total Fee">
								<ValueMosaic isNative amount={blockInfo.totalFee} />
							</Field>
							<Field title="Median Fee">
								<ValueMosaic isNative amount={blockInfo.medianFee} />
							</Field>
						</div>
						<Field title="Transaction Fees">
							<ValueTransactionSquares data={blockInfo.transactionFees} className={styles.valueTransactionSquares} />
						</Field>
					</div>
				</Section>
				<Section className="layout-align-end" cardClassName={styles.secondSectionCard}>
					<div className="layout-flex-col">
						<Field title="Harvester">
							<ValueAccount address={blockInfo.harvester} size="sm" />
						</Field>
						<Field title="Beneficiary">
							<ValueAccount address={blockInfo.beneficiary} size="sm" />
						</Field>
						<Field title="Transactions">{blockInfo.transactionCount}</Field>
						<Field title="Size">{blockInfo.size} B</Field>
						<Field title="Difficulty">{blockInfo.difficulty} %</Field>
						<Field title="Version">{blockInfo.version}</Field>
						<Field title="Signature">
							<ValueCopy value={blockInfo.signature} />
						</Field>
						<Field title="Hash">
							<ValueCopy value={blockInfo.hash} />
						</Field>
					</div>
				</Section>
			</div>
			<Section title={t('section_transactions')}>
				<Table data={transactions} columns={tableColumns} ItemMobile={ItemTransactionMobile} isLastPage={true} />
			</Section>
		</div>
	);
};

export default Blocks;
