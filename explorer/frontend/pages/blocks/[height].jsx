import { fetchBlockReceiptPage } from '@/api/blockReceipts';
import { fetchBlockInfo, fetchChainHight } from '@/api/blocks';
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
import config from '@/config';
import styles from '@/styles/pages/BlockInfo.module.scss';
import { useAsyncCall, useClientSidePagination, usePagination } from '@/utils';
import { pageConfig } from '@/variants';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect } from 'react';

const fetchNoopHeight = async () => 0;
const receiptGroups = {
	balanceChange: 'balanceChange',
	balanceTransfer: 'balanceTransfer',
	artifactExpiry: 'artifactExpiry',
	inflation: 'inflation'
};
const merkleRootFields = [
	['accountState', 'field_accountState'],
	['namespace', 'field_namespace'],
	['mosaic', 'field_mosaic'],
	['multisig', 'field_multisig'],
	['hashLockInfo', 'field_hashLockInfo'],
	['secretLookInfo', 'field_secretLookInfo'],
	['accountRestriction', 'field_accountRestriction'],
	['mosaicRestriction', 'field_mosaicRestriction'],
	['metadata', 'field_metadata']
];

const createMosaicList = value => (
	<ValueList
		data={value}
		direction="column"
		renderItem={mosaic => (
			<ValueMosaic
				mosaicId={mosaic.id}
				mosaicName={mosaic.name}
				amount={mosaic.amount}
				isNative={mosaic.isNative}
				isTickerShown
			/>
		)}
	/>
);

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

const BlockInfo = ({ blockInfo }) => {
	const { t } = useTranslation();
	const transactionInitialPagination = usePagination(
		async () => await fetchTransactionPage({ pageSize: blockInfo.transactionCount, height: blockInfo.height }),
		[]
	);
	const receiptPagination = usePagination(fetchBlockReceiptPage, [], { height: blockInfo.height });
	const transactionPagination = useClientSidePagination(transactionInitialPagination.data);
	const chainHeight = useAsyncCall(pageConfig.blocks.showFinalization ? fetchNoopHeight : fetchChainHight, 0);
	const isSafeBlock = chainHeight > 0 && chainHeight - blockInfo.height > config.BLOCKCHAIN_UNWIND_LIMIT;
	const statusType = pageConfig.blocks.showFinalization && blockInfo.isFinalized
		? 'finalized'
		: !pageConfig.blocks.showFinalization && isSafeBlock ? 'safe' : 'created';
	const statusText = pageConfig.blocks.showFinalization && blockInfo.isFinalized
		? t('label_finalized')
		: !pageConfig.blocks.showFinalization && isSafeBlock ? t('label_safe') : t('label_created');

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
	const balanceChangeReceiptColumns = [
		{ key: 'version', size: '6rem' },
		{ key: 'type', size: '13rem', renderValue: value => t(`receiptType_${value}`) },
		{ key: 'targetAddress', size: '23rem', renderValue: value => <ValueAccount address={value} size="sm" /> },
		{ key: 'mosaics', size: '14rem', renderValue: createMosaicList }
	];
	const balanceTransferReceiptColumns = [
		{ key: 'version', size: '6rem' },
		{ key: 'type', size: '13rem', renderValue: value => t(`receiptType_${value}`) },
		{ key: 'sender', size: '23rem', renderValue: value => <ValueAccount address={value} size="sm" /> },
		{ key: 'to', size: '23rem', renderValue: value => <ValueAccount address={value} size="sm" /> },
		{ key: 'mosaics', size: '14rem', renderValue: createMosaicList }
	];
	const artifactExpiryReceiptColumns = [
		{ key: 'version', size: '6rem' },
		{ key: 'type', size: '13rem', renderValue: value => t(`receiptType_${value}`) },
		{ key: 'artifactId', size: '16rem' }
	];
	const inflationReceiptColumns = [
		{ key: 'version', size: '6rem' },
		{ key: 'type', size: '13rem', renderValue: value => t(`receiptType_${value}`) },
		{ key: 'mosaics', size: '14rem', renderValue: createMosaicList }
	];
	const getReceiptData = group => receiptPagination.data.filter(receipt => receipt.group === group);
	const createReceiptTable = (group, columns) => (
		<Table
			data={getReceiptData(group)}
			columns={columns}
			isLoading={receiptPagination.isLoading}
			isLastPage={receiptPagination.isLastPage}
			isError={receiptPagination.isError}
			onEndReached={receiptPagination.requestNextPage}
			isHeaderSticky={false}
		/>
	);
	const receiptTabs = [
		{
			label: t('section_balanceChangeReceipt'),
			content: createReceiptTable(receiptGroups.balanceChange, balanceChangeReceiptColumns)
		},
		{
			label: t('section_balanceTransferReceipt'),
			content: createReceiptTable(receiptGroups.balanceTransfer, balanceTransferReceiptColumns)
		},
		{
			label: t('section_artifactExpiryReceipt'),
			content: createReceiptTable(receiptGroups.artifactExpiry, artifactExpiryReceiptColumns)
		},
		{
			label: t('section_inflationReceipt'),
			content: createReceiptTable(receiptGroups.inflation, inflationReceiptColumns)
		}
	];

	useEffect(() => {
		transactionInitialPagination.initialRequest();
	}, [blockInfo.height]);

	useEffect(() => {
		if (pageConfig.blocks.showBlockReceipts)
			receiptPagination.initialRequest();
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
								<ValueLabel text={statusText} type={statusType} />
							</Field>
							<FieldTimestamp value={blockInfo.timestamp} hasTime hasSeconds />
						</div>
						<div className="layout-grid-row">
							<Field title={t('field_totalFee')} description={t('field_totalFee_description')}>
								<ValueMosaic isNative amount={blockInfo.totalFee} />
							</Field>
							{pageConfig.blocks.showBlockType && (
								<Field title={t('field_blockType')}>
									{blockInfo.blockType}
								</Field>
							)}
						</div>
						<Field title={t('field_transactionFees')}>
							<ValueTransactionSquares
								isTransactionPreviewEnabled
								data={transactionInitialPagination.data}
								isLoading={transactionInitialPagination.isLoading}
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
						{pageConfig.blocks.showBlockExtendedDetails && (
							<Field title={t('field_beneficiaryAddress')}>
								<ValueAccount address={blockInfo.beneficiaryAddress} size="sm" />
							</Field>
						)}
						<div className="layout-grid-row">
							<Field title={t('field_transactions')}>{blockInfo.transactionCount}</Field>
							{pageConfig.blocks.showBlockExtendedDetails && (
								<Field title={t('field_statements')}>{blockInfo.statementCount}</Field>
							)}
						</div>
						{!pageConfig.blocks.showBlockExtendedDetails && <Field title={t('field_size')}>{blockInfo.size} B</Field>}
						<div className="layout-grid-row">
							<Field title={t('field_difficulty')}>
								{pageConfig.blocks.showBlockExtendedDetails ? blockInfo.rawDifficulty : `${blockInfo.difficulty} %`}
							</Field>
							{pageConfig.blocks.showBlockExtendedDetails && (
								<Field title={t('field_feeMultiplier')}>{blockInfo.feeMultiplier}</Field>
							)}
						</div>
						<Field title={t('field_signature')}>
							<ValueCopy value={blockInfo.signature} />
						</Field>
						<Field title={t('field_hash')}>
							<ValueCopy value={blockInfo.hash} />
						</Field>
						{pageConfig.blocks.showBlockExtendedDetails && (
							<>
								<Field title={t('field_proofGamma')}>
									<ValueCopy value={blockInfo.proofGamma} />
								</Field>
								<Field title={t('field_proofScalar')}>
									<ValueCopy value={blockInfo.proofScalar} />
								</Field>
								<Field title={t('field_proofVerificationHash')}>
									<ValueCopy value={blockInfo.proofVerificationHash} />
								</Field>
							</>
						)}
					</div>
				</Section>
			</div>
			{pageConfig.blocks.showBlockMerkleInfo && (
				<Section title={t('section_merkleInfo')}>
					<div className="layout-flex-col-fields">
						<Field title={t('field_stateHash')}>
							<ValueCopy value={blockInfo.stateHash} />
						</Field>
						<div className={styles.merkleSeparator} />
						<Field title={t('field_stateHashSubCacheMerkleRoots')}>
							<div className={styles.merkleRoots}>
								{merkleRootFields.map(([key, titleKey]) => (
									<div className={styles.merkleRoot} key={key}>
										<div className={styles.merkleRootTitle}>{t(titleKey)}</div>
										<ValueCopy value={blockInfo.stateHashSubCacheMerkleRoots?.[key]} />
									</div>
								))}
							</div>
						</Field>
						<div className={styles.merkleSeparator} />
						<div className="layout-grid-row">
							<Field title={t('field_receiptsHash')}>
								<ValueCopy value={blockInfo.receiptsHash} />
							</Field>
							<Field title={t('field_transactionHash')}>
								<ValueCopy value={blockInfo.transactionsHash} />
							</Field>
						</div>
					</div>
				</Section>
			)}
			{pageConfig.blocks.showBlockReceipts && <Section title={t('section_receipts')} tabs={receiptTabs} />}
			<Section title={t('section_transactions')}>
				<Table
					columns={tableColumns}
					renderItemMobile={data => <ItemTransactionMobile data={data} />}
					data={transactionPagination.data}
					isLoading={transactionInitialPagination.isLoading}
					isLastPage={transactionPagination.isLastPage}
					isError={transactionInitialPagination.isError}
					onEndReached={transactionPagination.requestNextPage}
				/>
			</Section>
		</div>
	);
};

export default BlockInfo;
