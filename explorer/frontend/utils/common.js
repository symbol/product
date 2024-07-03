import { TRANSACTION_CHART_TYPE } from '@/constants';

/**
 * Converts date to a readable text string.
 * @param {string} dateStr - Date string.
 * @param {Function} translate - Translation function.
 * @param {object} config - Configuration object.
 * @param {string} config.type - Date type 'local' or 'UTC'.
 * @param {boolean} config.hasTime - Whether to include time.
 * @param {boolean} config.hasSeconds - Whether to include seconds.
 * @param {boolean} config.hasDays - Whether to include days.
 * @returns {string} Formatted date.
 * @example
 * formatDate('2021-01-01T00:00:00.000Z', translate, { type: 'local', hasTime: true, hasSeconds: true, hasDays: true });
 */
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

/**
 * Converts date to a local date.
 * @param {string} date - Date string.
 * @returns {Date} Local date.
 */
export const dateToLocalDate = date => {
	const dateMilliseconds = new Date(date).getTime();
	const localTimezoneOffsetMinutes = new Date().getTimezoneOffset();
	const millisecondsCoefficient = 60000;

	return new Date(dateMilliseconds - (localTimezoneOffsetMinutes * millisecondsCoefficient));
};

/**
 * Converts number to a short string (e.g. "1K", "12M").
 * @param {number} num - Number.
 * @returns {string} Short string.
 * @example
 * numberToShortString(1234567); // "1.23M"
 */
export const numberToShortString = num => {
	if (isNaN(num))
		return '';

	const value = num.toString().replace(/[^0-9.]/g, '');

	if (1000 > value)
		return '' + value;

	let si = [
		{ v: 1e3, s: 'K' },
		{ v: 1e6, s: 'M' },
		{ v: 1e9, s: 'B' }
	];

	let index;
	for (index = si.length - 1; 0 < index; --index) {
		if (value >= si[index].v)
			break;
	}

	return (value / si[index].v).toFixed(2).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, '$1') + si[index].s;
};

/**
 * Converts number to a string.
 * @param {number} num - Number.
 * @returns {string} String.
 * @example
 * numberToString(1234567); // "1 234 567"
 */
export const numberToString = num => {
	if (isNaN(num))
		return '';

	return num.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ' ');
};

/**
 * Truncates a number to a specified decimal.
 * @param {number} num - Number.
 * @param {number} decimal - Decimal.
 * @returns {number} Truncated number.
 * @example
 * truncateDecimals(1.2345, 2); // 1.23
 */
export const truncateDecimals = (num, decimal) => {
	const multiplier = Math.pow(10, decimal);
	const adjustedNum = num * multiplier;
	let truncatedNum;

	if (adjustedNum < 0)
		truncatedNum = Math.ceil(adjustedNum);
	else
		truncatedNum = Math.floor(adjustedNum);

	return truncatedNum / multiplier;
};

/**
 * Truncates a string.
 * @param {string} str - String.
 * @param {string} type - Type.
 * @returns {string} Truncated string.
 * @example
 * truncateString('NAGJG3QFWYZ37LMI7IQPSGQNYADGSJZGJRD2DIYA', 'address'); // "NAGJG3...DIYA"
 * truncateString('NAGJG3QFWYZ37LMI7IQPSGQNYADGSJZGJRD2DIYA', 'address-short'); // "...IYA"
 * truncateString('DF63A631B0D29C807CBEE57FECBB6C7AC424A3171B70F82547922FCB0E7C0E6C', 'hash'); // "DF63...0E6C"
 */
export const truncateString = (str, type) => {
	if (typeof str !== 'string')
		return '';

	const trunc = (text, cut, lengthFirst, lengthSecond) => {
		if (cut === 'start' && lengthFirst < text.length)
			return '...' + text.substring(text.length - lengthFirst, text.length);
		if (cut === 'middle' && lengthFirst + lengthSecond < text.length)
			return text.substring(0, lengthFirst) + '...' + text.substring(text.length - lengthSecond, text.length);
		if (cut === 'end' && lengthFirst < text.length)
			return text.substring(0, lengthFirst) + '...';

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

/**
 * Replaces empty value with a placeholder.
 * @param {any} value - Value.
 * @returns {(any|string)} Transformed value.
 * @example
 * nullableValueToText(null); // "-"
 * nullableValueToText(undefined); // "-"
 * nullableValueToText(123); // 123
 */
export const nullableValueToText = value => {
	return value === null || value === undefined ? '-' : value;
};

/**
 * Transforms array into the text string.
 * @param {Array} value - Array.
 * @returns {string} Text string.
 * @example
 * arrayToText([]); // "-"
 * arrayToText(['one', 'two']); // "one, two"
 */
export const arrayToText = value => {
	return value.length === 0 ? '-' : value.join(', ');
};

/**
 * Extracts root namespace name from the namespace name.
 * @param {string} namespaceName - Namespace name.
 * @returns {string} Root namespace name.
 * @example
 * getRootNamespaceName('nem'); // "nem"
 * getRootNamespaceName('nem.xem'); // "nem"
 */
export const getRootNamespaceName = namespaceName => namespaceName.split('.')[0];

/**
 * Creates mosaic name.
 * @param {string} namespaceId - Namespace id.
 * @param {string} mosaicId - Mosaic id.
 * @returns {string} Mosaic name.
 * @example
 * createMosaicName('nem', 'xem'); // "nem.xem"
 */
export const createMosaicName = (namespaceId, mosaicId) => `${namespaceId}.${mosaicId}`;

/**
 * Transforms transaction data row for CSV export.
 * @param {object} row - Data row.
 * @param {Function} translate - Translation function.
 * @returns {object} Transformed data row.
 */
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

/**
 * Transforms account data row for CSV export.
 * @param {object} row - Data row.
 * @param {Function} translate - Translation function.
 * @returns {object} Transformed data row.
 */
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

/**
 * Transforms block data row for CSV export.
 * @param {object} row - Data row.
 * @param {Function} translate - Translation function.
 * @returns {object} Transformed data row.
 */
export const formatBlockCSV = (row, translate) => {
	return {
		[translate('table_field_height')]: row.height,
		[translate('table_field_harvester')]: row.harvester,
		[translate('table_field_transactionCount')]: row.transactionCount,
		[translate('table_field_totalFee')]: row.totalFee,
		[translate('table_field_timestamp')]: row.timestamp
	};
};

/**
 * Transforms mosaic data row for CSV export.
 * @param {object} row - Data row.
 * @param {Function} translate - Translation function.
 * @returns {object} Transformed data row.
 */
export const formatMosaicCSV = (row, translate) => {
	return {
		[translate('table_field_name')]: row.name,
		[translate('table_field_amount')]: row.amount
	};
};

/**
 * Decodes transaction message text from hex string.
 * @param {string} text - Hex string.
 * @returns {string} Decoded text.
 * @example
 * decodeTransactionMessage('48656C6C6F'); // "Hello"
 */
export const decodeTransactionMessage = text => {
	return Buffer.from(text, 'hex').toString();
};

/**
 * Converts transaction chart filter to type.
 * @param {object} filter - Transaction chart filter.
 * @param {boolean} filter.isPerDay - The daily transaction chart.
 * @param {boolean} filter.isPerMonth - The monthly transaction chart.
 * @returns {string} Transaction chart type.
 */
export const transactionChartFilterToType = filter => {
	return filter.isPerDay
		? TRANSACTION_CHART_TYPE.DAILY
		: filter.isPerMonth
			? TRANSACTION_CHART_TYPE.MONTHLY
			: TRANSACTION_CHART_TYPE.BLOCK;
};

/**
 * Formats transaction chart data.
 * @param {Array} data - Transaction chart data.
 * @param {string} type - Transaction chart type.
 * @param {Function} translate - Translation function.
 * @returns {Array} Formatted transaction chart data.
 */
export const formatTransactionChart = (data, type, translate) => {
	return data.map(item => {
		switch (type) {
		case TRANSACTION_CHART_TYPE.DAILY:
			return [formatDate(item[0], translate), item[1]];
		case TRANSACTION_CHART_TYPE.MONTHLY:
			return [formatDate(item[0], translate, { hasDays: false }), item[1]];
		default:
			return [translate('chart_label_block', { height: item[0] }), item[1]];
		}
	});
};

/**
 * Creates expiration label.
 * @param {number} expirationHeight - Expiration height.
 * @param {number} chainHeight - Current chain height.
 * @param {boolean} isUnlimitedDuration - Whether duration is unlimited.
 * @param {Function} translate - Translation function.
 * @returns {object} Expiration label.
 */
export const createExpirationLabel = (expirationHeight, chainHeight, isUnlimitedDuration, translate) => {
	const isActive = isUnlimitedDuration || chainHeight < expirationHeight;
	const status = isActive ? 'active' : 'inactive';
	const text = isActive ? translate('label_active') : translate('label_expired');

	return { status, text };
};
