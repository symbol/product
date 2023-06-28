import styles from '@/styles/components/Table.module.scss';
import { useTranslation } from 'next-i18next';
import dynamic from 'next/dynamic';
const TablePageLoader = dynamic(
	() => import('./TablePageLoader'),
	{ ssr: false }
);

const Table = ({ data, columns, ItemMobile, onEndReached, isLoading, isLastPage }) => {
	const { t } = useTranslation('common');

	return (
		<div className={styles.table}>
			<div className={styles.header}>
				{columns.map((item, index) => (
					<div className={styles.headerCell} style={{width: item.size}} key={'th' + index}>
						{t(`table_field_${item.key}`)}
					</div>
				))}
			</div>
			<div className={styles.data}>
				{data.map((row, index) => (
					<div className={styles.dataRow} key={'tr' + index}>
						{columns.map((item, index) => (
							<div className={styles.dataCell} style={{width: item.size}} key={'td' + index}>
								{item.renderValue ? item.renderValue(row[item.key]) : row[item.key]}
							</div>
						))}
					</div>
				))}
			</div>

			{!!ItemMobile && <div className={styles.dataMobile}>
				{data.map((item, index) => (
					<div className={styles.itemMobile} key={'trm' + index}>
						<ItemMobile data={item}/>
					</div>
				))}
			</div>}

			{!isLastPage && <TablePageLoader isLoading={isLoading} onLoad={onEndReached} />}
		</div>
	)
}

export default Table;
