// Converts date to a readable text string.
export const formatDate = (dateStr, translate, config = {}) => {
	const { type, hasTime = false, hasSeconds = false, hasDays = true } = config;
	const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

	const addZero = num => {
		return 0 <= num && 10 > num ? '0' + num : num + '';
	};

	const dateObj = type === 'local' ? dateToLocalDate(dateStr) : new Date(dateStr);
	const seconds = addZero(dateObj.getSeconds());
	const minutes = addZero(dateObj.getMinutes());
	const hour = addZero(dateObj.getHours());
	const month = 'function' === typeof translate ? translate('month_' + months[dateObj.getMonth()]) : months[dateObj.getMonth()];
	const day = dateObj.getDate();
	const year = dateObj.getFullYear();

	let formattedDate = `${month}`;
	formattedDate += hasDays ? ` ${day}` : '';
	formattedDate += `, ${year}`;
	formattedDate += hasTime ? ` • ${hour}:${minutes}` : '';
	formattedDate += hasTime && hasSeconds ? `:${seconds}` : '';

	return formattedDate;
};

// Converts cain timestamp to a local date. Adds timezone offset.
export const dateToLocalDate = date => {
	return new Date(new Date(date).getTime() - new Date(date).getTimezoneOffset() * 60000);
};

// Converts number to a text string (e.g. "1K", "12M")
export const numberToShortString = num => {
	if (isNaN(num)) {
		return '';
	}

	const value = num.toString().replace(/[^0-9.]/g, '');

	if (1000 > value) return '' + value;

	let si = [
		{ v: 1e3, s: 'K' },
		{ v: 1e6, s: 'M' },
		{ v: 1e9, s: 'B' }
	];

	let index;
	for (index = si.length - 1; 0 < index; --index) {
		if (value >= si[index].v) break;
	}

	return (value / si[index].v).toFixed(2).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, '$1') + si[index].s;
};

// Converts number to string.
export const numberToString = num => {
	if (isNaN(num)) {
		return '';
	}

	return num.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ' ');
};

// Truncates a number to a specified decimal.
export const truncateDecimals = (num, decimal) => {
	const multiplier = Math.pow(10, decimal);
	const adjustedNum = num * multiplier;
	let truncatedNum;

	if (adjustedNum < 0) {
		truncatedNum = Math.ceil(adjustedNum);
	} else {
		truncatedNum = Math.floor(adjustedNum);
	}

	return truncatedNum / multiplier;
};

// Truncates a string using a "type" parameter.
export const truncateString = (str, type) => {
	if (typeof str !== 'string') {
		return '';
	}

	const trunc = (text, cut, lengthFirst, lengthSecond) => {
		if (cut === 'start' && lengthFirst < text.length) {
			return '...' + text.substring(text.length - lengthFirst, text.length);
		}
		if (cut === 'middle' && lengthFirst + lengthSecond < text.length) {
			return text.substring(0, lengthFirst) + '...' + text.substring(text.length - lengthSecond, text.length);
		}
		if (cut === 'end' && lengthFirst < text.length) {
			return text.substring(0, lengthFirst) + '...';
		}

		return text;
	};

	switch (type) {
		case 'address':
			return trunc(str, 'middle', 6, 3);
		case 'address-short':
			return trunc(str, 'start', 3);
		case 'hash':
			return trunc(str, 'middle', 4, 4);
		default:
			return trunc(str, 'end', 9);
	}
};

// Replaces empty value with a placeholder
export const nullableValueToText = value => {
	return value === null || value === undefined ? '-' : value;
};

// Transforms array into the text string.
export const arrayToText = value => {
	return value.length === 0 ? '-' : value.join(', ');
};

export const getRootNamespaceName = namespaceName => namespaceName.split('.')[0];

export const createMosaicName = (namespaceId, mosaicId) => `${namespaceId}.${mosaicId}`;

// Transforms transaction data row for CSV export.
export const formatTransactionCSV = (row, translate) => {
	return {
		[translate('table_field_type')]: translate(`transactionType_${row.type}`),
		[translate('table_field_sender')]: row.sender,
		[translate('table_field_recipient')]: row.recipient,
		[translate('table_field_amount')]: row.amount,
		[translate('table_field_fee')]: row.fee,
		[translate('table_field_timestamp')]: row.timestamp,
		[translate('table_field_height')]: row.height,
		[translate('table_field_hash')]: row.hash,
		[translate('table_field_value')]: row.value.map(item => `${item.amount}(${item.name})`).join(' ')
	};
};

// Transforms account data row for CSV export.
export const formatAccountCSV = (row, translate) => {
	return {
		[translate('table_field_address')]: row.address,
		[translate('table_field_balance')]: row.balance,
		[translate('table_field_importance')]: row.importance,
		[translate('table_field_isMultisig')]: row.isMultisig ? translate('value_true') : translate('value_false'),
		[translate('table_field_isHarvestingActive')]: row.isHarvestingActive ? translate('value_true') : translate('value_false'),
		[translate('table_field_description')]: row.description
	};
};

// Transforms block data row for CSV export.
export const formatBlockCSV = (row, translate) => {
	return {
		[translate('table_field_height')]: row.height,
		[translate('table_field_harvester')]: row.harvester,
		[translate('table_field_transactionCount')]: row.transactionCount,
		[translate('table_field_totalFee')]: row.totalFee,
		[translate('table_field_timestamp')]: row.timestamp
	};
};

// Transforms mosaic data row for CSV export.
export const formatMosaicCSV = (row, translate) => {
	return {
		[translate('table_field_name')]: row.name,
		[translate('table_field_amount')]: row.amount
	};
};

// Decodes transaction message text from hex string.
export const decodeTransactionMessage = text => {
	return Buffer.from(text, 'hex').toString();
};
