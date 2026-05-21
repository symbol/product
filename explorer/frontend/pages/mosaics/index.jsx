import { fetchChainHight } from '@/api/blocks';
import { fetchMosaicPage } from '@/api/mosaics';
import FieldTimestamp from '@/components/FieldTimestamp';
import ItemMosaicMobile from '@/components/ItemMosaicMobile';
import Section from '@/components/Section';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueBlockHeight from '@/components/ValueBlockHeight';
import ValueLabel from '@/components/ValueLabel';
import ValueMosaicAliases from '@/components/ValueMosaicAliases';
import ValueMosaicAmount from '@/components/ValueMosaicAmount';
import ValueMosaicFlags from '@/components/ValueMosaicFlags';
import ValueTimestamp from '@/components/ValueTimestamp';
import styles from '@/styles/pages/Home.module.scss';
import { createExpirationLabel, createPageHref, useAsyncCall, usePagination } from '@/utils';
import { pageConfig } from '@/variants';
import Head from 'next/head';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps = async ({ locale }) => {
	const mosaicPage = await fetchMosaicPage();

	return {
		props: {
			mosaics: mosaicPage.data,
			...(await serverSideTranslations(locale, ['common']))
		}
	};
};

const Mosaics = ({ mosaics }) => {
	const { t } = useTranslation();
	const { requestNextPage, data, isLoading, isLastPage, isError } = usePagination(fetchMosaicPage, mosaics);
	const chainHeight = useAsyncCall(fetchChainHight, 0);

	const tableColumns = [
		{
			key: 'name',
			size: '16rem',
			renderTitle: () => t(pageConfig.mosaics.nameColumnTitleKey),
			renderValue: value => <Link href={createPageHref('mosaics', value)} className={styles.tableValueWrap}>{value}</Link>
		},
		...(pageConfig.mosaics.showAlias
			? [
				{
					key: 'aliasNames',
					size: '11rem',
					renderTitle: () => t('table_field_alias'),
					renderValue: value => <ValueMosaicAliases aliases={value} className={styles.tableValueWrap} />
				}
			]
			: []),
		{
			key: 'creator',
			size: pageConfig.mosaics.showValue ? '34rem' : '30rem',
			renderValue: value => <ValueAccount address={value} size="sm" raw={pageConfig.mosaics.showValue} />
		},
		...(pageConfig.mosaics.showValue
			? [
				{
					key: 'value',
					size: '10rem',
					renderValue: value => <ValueMosaicAmount value={value} />
				}
			]
			: []),
		...(pageConfig.mosaics.showFlags
			? [
				{
					key: 'flags',
					size: '9rem',
					renderTitle: () => t('table_field_flags'),
					renderValue: (value, row) => <ValueMosaicFlags mosaic={row} />
				}
			]
			: []),
		...(pageConfig.mosaics.showStatus
			? [
				{
					key: 'status',
					size: '5rem',
					renderValue: (value, row) => {
						const { status, text } = createExpirationLabel(
							row.namespaceExpirationHeight,
							chainHeight,
							row.isUnlimitedDuration,
							t
						);

						return <ValueLabel type={status} title={text} />;
					}
				}
			]
			: []),
		...(pageConfig.mosaics.showRegistration
			? [
				{
					key: 'registrationHeight',
					size: '10rem',
					renderValue: value => <ValueBlockHeight value={value} />
				}
			]
			: []),
		...(pageConfig.mosaics.showExpiration
			? [
				{
					key: 'expirationHeight',
					size: '8rem',
					renderValue: value => value === 0 ? 'INFINITY' : <ValueBlockHeight value={value} />
				}
			]
			: []),
		...(pageConfig.mosaics.showCreated
			? [
				{
					key: 'registrationTimestamp',
					size: '11rem',
					renderTitle: () => <FieldTimestamp title={t('field_created')} />,
					renderValue: value => <ValueTimestamp value={value} hasTime />
				}
			]
			: [])
	];

	return (
		<div className={styles.wrapper}>
			<Head>
				<title>{t('page_mosaics')}</title>
			</Head>
			<Section title={t('section_mosaics')}>
				<Table
					data={data}
					columns={tableColumns}
					renderItemMobile={data => <ItemMosaicMobile data={data} chainHeight={chainHeight} />}
					isLoading={isLoading}
					isLastPage={isLastPage}
					isError={isError}
					isLastColumnAligned={true}
					isHeaderSticky={!pageConfig.mosaics.showValue}
					onEndReached={requestNextPage}
				/>
			</Section>
		</div>
	);
};

export default Mosaics;
