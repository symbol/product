import { getBlockInfoStub, getBlocksStub } from '../../../stubs/blocks';
import { createPage, createSearchCriteria } from '@/utils';

export default async function handler(req, res) {
	if (req.method !== 'GET') {
		return;
	}

	const data = await getBlockPage(req.query);

	res.status(200).json(data);
}

export const fetchBlockPage = async searchCriteria => {
	const params = new URLSearchParams(searchCriteria).toString();
	const response = await fetch(`/api/blocks?${params}`);

	return response.json();
};

export const getBlockPage = async searchCriteria => {
	const { pageNumber, pageSize } = createSearchCriteria(searchCriteria);
	const blocks = await getBlocksStub({ pageNumber, pageSize });

	return createPage(blocks, pageNumber);
};

export const getBlockInfo = async height => {
	return getBlockInfoStub(height);
};
