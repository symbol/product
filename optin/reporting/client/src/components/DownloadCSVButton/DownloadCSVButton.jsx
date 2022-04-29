import Helper from '../../utils/helper';
import {Button} from 'primereact/button';
import { useState } from 'react';
import './DownloadCSVButton.scss';
const moment = require('moment-timezone');

const DownloadCSVButton = ({activePage}) => {
	const [downloading, setDownloading] = useState(false);

	const downloadAllAsCSV = async () => {
		if ('completed' === activePage)
		{await Helper.downloadAllAsCSV({apiUrl: `/api/completed/download?timezone=${moment.tz.guess().toString()}`,
			fileName: 'optin-completed.csv', setDownloading});}
		else if ('inProgress' === activePage)
		{await Helper.downloadAllAsCSV({apiUrl: `/api/requests/download?timezone=${moment.tz.guess().toString()}`,
			fileName: 'optin-requests.csv', setDownloading});}
	};

	return (
		<Button type="button" icon="pi pi-download" className="ml-6 p-button-outlined download-button"
			onClick={downloadAllAsCSV} tooltip="Download All Data as CSV File"
			tooltipOptions={{position: 'top'}} loading={downloading}/>
	);
};

export default DownloadCSVButton;
