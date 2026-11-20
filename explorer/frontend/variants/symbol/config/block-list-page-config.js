import { PAGINATION_MODE } from '@/app/constants';

/** @typedef {import('@/contract/types/Config').BlockListPageConfig} BlockListPageConfig */

/** @type {BlockListPageConfig} */
export const blockListPageConfig = {
	paginationMode: PAGINATION_MODE.CURSOR,
	isStatementCountColumnVisible: true,
	isBlockRewardColumnVisible: true
};
