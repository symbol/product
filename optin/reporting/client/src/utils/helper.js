const Helper = {
	toRelativeAmount: amount => amount / (10 ** 6),
	downloadFile: ({ data, fileName, fileType }) => {
		const blob = new Blob([data], { type: fileType });
  
		const a = document.createElement('a');
		a.download = fileName;
		a.href = window.URL.createObjectURL(blob);
		const clickEvt = new MouseEvent('click', {
			view: window,
			bubbles: true,
			cancelable: true
		});
		a.dispatchEvent(clickEvt);
		a.remove();
	},
	downloadAllAsCSV: async ({apiUrl, fileName, setDownloading}) => {
		setDownloading(true);
		await fetch(apiUrl, {
			method: 'get',
			headers: {
				'content-type': 'text/csv;charset=UTF-8'
			}
		}).then(async res => Helper.downloadFile({ data: await res.text(), fileName, fileType: 'text/csv' }));
		setDownloading(false);
	}
};

export default Helper;