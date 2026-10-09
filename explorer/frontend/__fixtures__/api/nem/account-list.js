import { cosignatoryAccountResponse, harvestingAccountResponse, multisigAccountResponse } from './account-info';

// eslint-disable-next-line no-unused-vars
const withoutMainAddress = ({ mainAddress, ...account }) => account;

export const accountListResponse = [
	harvestingAccountResponse,
	cosignatoryAccountResponse,
	multisigAccountResponse
].map(withoutMainAddress);
