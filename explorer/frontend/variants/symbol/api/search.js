import { fetchBlockInfo } from './blocks';
import { fetchTransactionInfo } from './transactions';

export const search = async text => {
	const query = `${text}`.trim();
	const isHash = query.length === 64;

	return [
		{
			type: 'blocks',
			data: await fetchBlockInfo(query)
		},
		{
			type: 'transactions',
			data: isHash ? await fetchTransactionInfo(query) : null
		},
		{
			type: 'accounts',
			data: null
		},
		{
			type: 'mosaics',
			data: null
		},
		{
			type: 'namespaces',
			data: null
		}
	];
};
