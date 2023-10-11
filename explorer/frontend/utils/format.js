export const formatDate = (dateStr, translate, config = {}) => {
	const { type, hasTime = false, hasSeconds = false, hasDays = true } = config;
	const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

	const addZero = num => {
		return 0 <= num && 10 > num ? '0' + num : num + '';
	};

	const dateObj =
		type === 'local' ? new Date(dateStr) : new Date(new Date(dateStr).getTime() + new Date(dateStr).getTimezoneOffset() * 60000);
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

export const numberToShortString = num => {
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

export const numberToString = num => {
	return (+num).toLocaleString('en').replace(/,/g, ' ');
};

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

export const getRootNamespaceName = namespaceName => namespaceName.split('.')[0];

export const createMosaicName = (namespaceId, mosaicId) => `${namespaceId}.${mosaicId}`;

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
