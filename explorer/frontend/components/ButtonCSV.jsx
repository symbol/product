import styles from '@/styles/components/ButtonCSV.module.scss';
import { useTranslation } from 'next-i18next';
import { CSVLink } from 'react-csv';

const ButtonCSV = ({ className, data, fileName }) => {
	const { t } = useTranslation();
	const text = t('button_csv');
	const defaultFileName = 'explorer-export';

	return (
		<CSVLink className={`${styles.buttonCSV} ${className}`} filename={`${fileName || defaultFileName}.csv`} data={data}>
			{text}
		</CSVLink>
	);
};

export default ButtonCSV;
