import { getAccountInfoStub, getAccountsStub } from '../stubs/accounts';
import { createPage, createSearchCriteria } from '@/utils';

export const fetchAccountPage = async (searchCriteria = {}) => {
	const { pageNumber, pageSize } = createSearchCriteria(searchCriteria);
	const accounts = await getAccountsStub({ pageNumber, pageSize });

	return createPage(searchCriteria.isService ? [] : accounts, pageNumber);
};

export const fetchAccountInfo = async height => {
	const accountInfo = await getAccountInfoStub(height);

	return {
		remoteAddress: accountInfo.remoteAddress,
		address: accountInfo.address,
		publicKey: accountInfo.publicKey,
		description: accountInfo.remarkLabel,
		balance: accountInfo.balance,
		vestedBalance: accountInfo.vestedBalance,
		mosaics: accountInfo.mosaics,
		importance: accountInfo.importance,
		harvestedBlocks: accountInfo.harvestedBlocks,
		harvestedFees: accountInfo.harvestedFees,
		height: accountInfo.createdHeight,
		minCosignatories: accountInfo.minCosignatories,
		cosignatoryOf: accountInfo.cosignatoryOf,
		cosignatories: accountInfo.cosignatories,
		isMultisig: accountInfo.cosignatories.length > 0,
		isHarvestingActive: accountInfo.harvestRemoteStatus === 'active'
	};
};
