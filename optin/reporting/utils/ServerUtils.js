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
	}
};

module.exports = ServerUtils;
