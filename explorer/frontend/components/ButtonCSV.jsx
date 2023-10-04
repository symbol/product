import styles from '@/styles/components/ButtonCSV.module.scss';
import { useTranslation } from 'next-i18next';
import { CSVLink } from 'react-csv';

const ButtonCSV = ({ className, data, fileName, format }) => {
	const { t } = useTranslation();
	const text = t('button_csv');
	const defaultFileName = 'explorer-export';
	const formattedData = format ? data.map(format) : data;

	return (
		<CSVLink className={`${styles.buttonCSV} ${className}`} filename={`${fileName || defaultFileName}.csv`} data={formattedData}>
			{text}
		</CSVLink>
	);
};

export default ButtonCSV;
