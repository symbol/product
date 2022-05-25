import moment from 'moment-timezone';

const Helper = {
	/**
	 * Converts absolute amount to relative amount.
	 * @param {number} amount absolute amount to be converted to relative amount
	 * @returns {number} relative amount
	 */
	toRelativeAmount: amount => {
		const number = parseInt(amount, 10);

		if (Number.isNaN(number))
			return undefined;

		return amount / (10 ** 6);
	},
	/**
	 * Downloads given data as a file.
	 * @param {object} Object containing data, fileName, fileType
	 */
	downloadFile: ({ data, fileName, fileType }) => {
		const blob = new Blob([data], { type: fileType });
		const link = document.createElement('a');
		link.download = fileName;
		link.href = window.URL.createObjectURL(blob);
		link.click();
		link.remove();
	},
	/**
	 * Downloads given URL as CSV file.
	 * @param {object} Object containing apiUrl, fileName, setDownloading
	 */
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
	/**
	 * Copies the given text to the clipboard.
	 * @param {string} textToCopy text to be copied to the clipboard
	 */
	copyToClipboard: textToCopy => {
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
		document.execCommand('copy');
		textArea.remove();
	},
	/**
	 * Convert unix timestamp to utc date time.
	 * @param {string} unixTimestamp unix timestamp in second.
	 * @param {string} timezone set to timezone.
	 * @returns {string} Date with format YY-MM-DD HH:mm:ss.
	 */
	 convertTimestampToDate: (unixTimestamp, timezone) => {
		if (!unixTimestamp)
			return unixTimestamp;

		const utcDate = moment.utc(unixTimestamp * 1000);

		if (timezone)
			utcDate.tz(timezone);

		return utcDate.format('YY-MM-DD HH:mm:ss');
	},
	/**
	 * Returns local browser timezone.
	 * @returns {string} Timezone name such as 'America/Los_Angeles'.
	 */
	getLocalTimezone: () => {
		return moment.tz.guess();
	},
	/**
	 * Fills array with given value.
	 * @param {number} size size of the array
	 * @param {object} toBeCopied value to be copied
	 * @returns {Array} Filled array.
	 */
	fillArray: (size, toBeCopied) => Array(size).fill().map(_ => toBeCopied)
};

export default Helper;
