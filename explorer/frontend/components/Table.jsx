import styles from '@/styles/components/Table.module.scss';
import dynamic from 'next/dynamic';
import { useTranslation } from 'next-i18next';
const TablePageLoader = dynamic(() => import('./TablePageLoader'), { ssr: false });

const Table = ({
	data,
	sections,
	columns,
	renderItemMobile,
	renderSectionHeader,
	onEndReached,
	isLoading,
	isLastPage,
	isLastColumnAligned
}) => {
	const { t } = useTranslation('common');

	const desktopTableStyle = !renderItemMobile ? styles.dataMobile : '';
	const headerCellStyle = `${styles.headerCell} ${isLastColumnAligned && styles.headerCell_aligned}`;
	const dataCellStyle = isLastColumnAligned ? styles.dataCell_aligned : '';

	const renderRow = (row, index) => (
		<div className={styles.dataRow} key={'tr' + index}>
			{columns.map((item, index) => (
				<div className={dataCellStyle} style={{ width: item.size }} key={'td' + index}>
					{item.renderValue ? item.renderValue(row[item.key], row) : row[item.key]}
				</div>
			))}
		</div>
	);
	const renderMobileListItem = (item, index) => (
		<div className={styles.itemMobile} key={'trm' + index}>
			{renderItemMobile(item)}
		</div>
	);

	return (
		<div className={styles.table}>
			<div className={styles.header}>
				{columns.map((item, index) => (
					<div className={headerCellStyle} style={{ width: item.size }} key={'th' + index}>
						{item.renderTitle ? item.renderTitle(item.key) : t(`table_field_${item.key}`)}
					</div>
				))}
			</div>
			{!!data && <div className={`${styles.data} ${desktopTableStyle}`}>{data.map(renderRow)}</div>}
			{!!data && !!renderItemMobile && <div className={styles.listMobile}>{data.map(renderMobileListItem)}</div>}
			{!!data && !data.length && <div className={styles.emptyListMessage}>{t('message_emptyTable')}</div>}
			{!!sections && !sections.length && <div className={styles.emptyListMessage}>{t('message_emptyTable')}</div>}

			{!!sections &&
				sections.map((section, index) => (
					<div className={styles.section} key={'sc' + index}>
						<div className={styles.sectionHeader}>{renderSectionHeader(section)}</div>
						<div className={`${styles.data} ${desktopTableStyle}`}>{section.data.map(renderRow)}</div>
						{!!renderItemMobile && <div className={styles.listMobile}>{section.data.map(renderMobileListItem)}</div>}
					</div>
				))}

			{!isLastPage && <TablePageLoader isLoading={isLoading} onLoad={onEndReached} />}
		</div>
	);
};

export default Table;
