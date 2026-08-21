import { fetchBlockInfo, fetchChainStatus } from '@/app/api/blocks';
import { fetchTransactionPage } from '@/app/api/transactions';
import Field from '@/app/components/Field';
import FieldTimestamp from '@/app/components/FieldTimestamp';
import ItemTransactionMobile from '@/app/components/ItemTransactionMobile';
import Section from '@/app/components/Section';
import Table from '@/app/components/Table';
import ValueAccount from '@/app/components/ValueAccount';
import ValueBlockStatus from '@/app/components/ValueBlockStatus';
import ValueCopy from '@/app/components/ValueCopy';
import ValueList from '@/app/components/ValueList';
import ValueMosaic from '@/app/components/ValueMosaic';
import ValueTransactionHash from '@/app/components/ValueTransactionHash';
import ValueTransactionSquares, { MAX_TRANSACTION_SQUARES } from '@/app/components/ValueTransactionSquares';
import ValueTransactionType from '@/app/components/ValueTransactionType';
import styles from '@/app/styles/pages/BlockInfo.module.scss';
import { useAsyncCall, useDataManager, usePagination } from '@/app/utils';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect } from 'react';

export const getServerSideProps = async ({ locale, params }) => {
	const blockInfo = await fetchBlockInfo(params.height);

	if (!blockInfo) {
		return {
			notFound: true
		};
	}

	return {
		props: {
			blockInfo,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const TRANSACTION_PAGE_SIZE = 50;

const BlockInfo = ({ blockInfo }) => {
	const { t } = useTranslation();
	const transactionPagination = usePagination(fetchTransactionPage, [], {
		height: blockInfo.height,
		pageSize: TRANSACTION_PAGE_SIZE
	});
	// The fee treemap needs every transaction of the block in a single request, so larger blocks skip it.
	const isTransactionSquaresAvailable = blockInfo.transactionCount <= MAX_TRANSACTION_SQUARES;
	const [fetchTransactionSquares, isTransactionSquaresLoading, transactionSquares] = useDataManager(
		async () => (await fetchTransactionPage({ pageSize: MAX_TRANSACTION_SQUARES, height: blockInfo.height })).data,
		[],
		null,
		isTransactionSquaresAvailable
	);
	const chainStatus = useAsyncCall(fetchChainStatus, null);

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

	useEffect(() => {
		transactionPagination.initialRequest();

		if (isTransactionSquaresAvailable)
			fetchTransactionSquares();
	}, [blockInfo.height]);

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
								<ValueBlockStatus block={blockInfo} chainStatus={chainStatus} />
							</Field>
							<FieldTimestamp value={blockInfo.timestamp} hasTime hasSeconds />
						</div>
						<Field title={t('field_totalFee')} description={t('field_totalFee_description')}>
							<ValueMosaic isNative amount={blockInfo.totalFee} />
						</Field>
						<Field title={t('field_transactionFees')}>
							<ValueTransactionSquares
								isTransactionPreviewEnabled
								data={transactionSquares}
								transactionCount={blockInfo.transactionCount}
								isLoading={isTransactionSquaresLoading}
								className={styles.valueTransactionSquares}
							/>
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
					columns={tableColumns}
					renderItemMobile={data => <ItemTransactionMobile data={data} />}
					data={transactionPagination.data}
					isLoading={transactionPagination.isLoading}
					isLastPage={transactionPagination.isLastPage}
					isError={transactionPagination.isError}
					onEndReached={transactionPagination.requestNextPage}
				/>
			</Section>
		</div>
	);
};

export default BlockInfo;
