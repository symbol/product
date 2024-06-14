import { fetchChainHight } from '@/api/blocks';
import { fetchMosaicPage } from '@/api/mosaics';
import FieldTimestamp from '@/components/FieldTimestamp';
import ItemMosaicMobile from '@/components/ItemMosaicMobile';
import Section from '@/components/Section';
import Table from '@/components/Table';
import ValueAccount from '@/components/ValueAccount';
import ValueBlockHeight from '@/components/ValueBlockHeight';
import ValueLabel from '@/components/ValueLabel';
import ValueTimestamp from '@/components/ValueTimestamp';
import styles from '@/styles/pages/Home.module.scss';
import { createPageHref, useAsyncCall, usePagination } from '@/utils';
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
			size: '20rem',
			renderValue: value => <Link href={createPageHref('mosaics', value)}>{value}</Link>
		},
		{
			key: 'creator',
			size: '30rem',
			renderValue: value => <ValueAccount address={value} size="sm" />
		},
		{
			key: 'status',
			size: '5rem',
			renderValue: (value, row) => {
				const isActive = row.isUnlimitedDuration || chainHeight < row.namespaceExpirationHeight;
				const status = isActive ? 'active' : 'inactive';
				const text = isActive ? t('label_active') : t('label_expired');

				return <ValueLabel type={status} title={text} />;
			}
		},
		{
			key: 'registrationHeight',
			size: '10rem',
			renderValue: value => <ValueBlockHeight value={value} />
		},
		{
			key: 'registrationTimestamp',
			size: '11rem',
			renderTitle: () => <FieldTimestamp title={t('field_created')} />,
			renderValue: value => <ValueTimestamp value={value} hasTime />
		}
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
					onEndReached={requestNextPage}
				/>
			</Section>
		</div>
	);
};

export default Mosaics;
