import Helper from '../../utils/helper';
import {Button} from 'primereact/button';
import { useState } from 'react';
import './DownloadCSVButton.scss';
const moment = require('moment-timezone');

const DownloadCSVButton = ({activePage}) => {
	const [downloading, setDownloading] = useState(false);

	const downloadAllAsCSV = async () => {
		const type = 'completed' === activePage ? 'completed' : 'inProgress' === activePage ? 'requests' : null;
		if (type) {
			Helper.downloadAllAsCSV({apiUrl: `/api/${type}/download?timezone=${moment.tz.guess().toString()}`,
				fileName: `optin-${type}.csv`, setDownloading});
		}
	};

	return (
		<Button type="button" icon="pi pi-download" className="ml-6 p-button-outlined download-button"
			onClick={downloadAllAsCSV} tooltip="Download All Data as CSV File"
			tooltipOptions={{position: 'top'}} loading={downloading}/>
	);
};

export default DownloadCSVButton;
