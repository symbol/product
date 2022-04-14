const moment = require('moment-timezone');

const symbolEpoch = moment(Date.UTC(2021, 3, 16, 0, 6, 25)).valueOf();
const nemEpoch = moment(Date.UTC(2015, 3, 29, 0, 6, 25)).valueOf();

const ServerUtils = {
	toRelativeAmount: amount => amount / (10 ** 6),
	byteToHexString: uint8arr => {
		if (!uint8arr)
			return '';

		let hexStr = '';
		for (let i = 0; i < uint8arr.length; i++) {
			let hex = (uint8arr[i] & 0xff).toString(16);
			hex = (1 === hex.length) ? `0${hex}` : hex;
			hexStr += hex;
		}

		return hexStr.toUpperCase();
	},
	hexStringToByte: str => {
		if (!str)
			return new Uint8Array();

		const a = [];
		for (let i = 0, len = str.length; i < len; i += 2)
			a.push(parseInt(str.substr(i, 2), 16));

		return new Uint8Array(a);
	},
	formatStringSplit: (string, separator = ';') => {
		if ('string' === typeof string) {
			const values = string.split(separator);
			if (1 < values.length)
				return values;

			return string;
		}
		return string;
	},
	convertTimestampToDate: (network, timestamp) => {
		if (null === timestamp)
			return timestamp;

		let networkTimestamp = 0;

		switch (network) {
		case 'Symbol':
			networkTimestamp = symbolEpoch + parseInt(timestamp, 10);
			break;
		case 'Nem':
			networkTimestamp = nemEpoch + (parseInt(timestamp, 10) * 1000);
			break;
		}

		return moment.utc(networkTimestamp).format('YYYY-MM-DD HH:mm:ss');
	}
};

module.exports = ServerUtils;
