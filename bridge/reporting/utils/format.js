export const formatAtomicAmount = (value, divisibility) => {
	if (null === value || value === undefined || '' === value)
		return '—';

	const digits = String(value);

	if (!/^\d+$/.test(digits))
		return digits;

	if (!divisibility)
		return digits;

	const padded = digits.padStart(divisibility + 1, '0');
	const whole = padded.slice(0, -divisibility);
	const fraction = padded.slice(-divisibility).replace(/0+$/, '');

	return `${whole}${fraction ? `.${fraction}` : ''}`;
};

export const formatPpm = value => formatAtomicAmount(value, 6);

export const formatTimestamp = value => {
	if (null === value || value === undefined)
		return '—';

	const date = new Date(Number(value) * 1000);
	if (Number.isNaN(date.getTime()))
		return '—';

	return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
};

export const truncateMiddle = (value, start = 8, end = 6) => {
	if (!value)
		return '—';

	const text = String(value);
	return text.length <= start + end ? text : `${text.slice(0, start)}…${text.slice(-end)}`;
};

export const createExplorerUrl = (network, type, value) => {
	if (!network?.explorerUrl || !value)
		return null;

	const baseUrl = network.explorerUrl.replace(/\/$/, '');
	if ('ethereum' === network.blockchain) {
		const path = 'transaction' === type ? 'tx' : 'address';
		const normalizedValue = 'transaction' === type ? `0x${value.replace(/^0x/i, '')}` : value;
		return `${baseUrl}/${path}/${normalizedValue}`;
	}

	if ('symbol' === network.blockchain || 'nem' === network.blockchain)
		return `${baseUrl}/${'transaction' === type ? 'transactions' : 'accounts'}/${value}`;

	return null;
};
