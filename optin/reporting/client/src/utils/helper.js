import moment from 'moment-timezone';

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
	},
	truncString: (str, strLen = 6) => {
		if ('string' === typeof str) {
			if (str.length > (strLen * 2) + 1)
				return `${str.substring(0, strLen)}...${str.substring(str.length - strLen, str.length)}`;
			return str;
		}
		return str;
	},
	copyToClipboard: textToCopy => {
		// navigator clipboard api needs a secure context (https)
		if (!navigator.clipboard && window.isSecureContext) {
			// navigator clipboard api method'
			return navigator.clipboard.writeText(textToCopy);
		} else {
			// text area method
			let textArea = document.createElement('textarea');
			textArea.value = textToCopy;
			// make the textarea out of viewport
			textArea.style.position = 'fixed';
			textArea.style.left = '-999999px';
			textArea.style.top = '-999999px';
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			return new Promise((res, rej) => {
				// deprecated but no other alternative and supported by major browsers
				document.execCommand('copy') ? res() : rej();
				textArea.remove();
			});
		}
	},
	/**
	 * Convert unix timestamp to utc date time.
	 * @param {number} unixTimestamp unix timestamp in second.
	 * @param {boolean} toLocal set to local timezone.
	 * @returns {string} Date with format YY-MM-DD HH:mm:ss.
	 */
	convertTimestampToDate: (unixTimestamp, toLocal = false) => {
		if (null === unixTimestamp)
			return unixTimestamp;

		const utcDate = moment.utc(unixTimestamp * 1000);

		if (toLocal) 
			utcDate.local();
		

		return utcDate.format('YY-MM-DD HH:mm:ss');
	}
};

export default Helper;