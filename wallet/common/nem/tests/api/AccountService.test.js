import { multisigAccountResponse, regularAccountResponse } from '../__fixtures__/api/account-dtos';
import { mosaicDefinitionDTO, ownedMosaicDTOs } from '../__fixtures__/api/mosaic-dtos';
import { accountInfo, multisigAccountInfo, multisigInfo, notFoundAccountInfo } from '../__fixtures__/local/account';
import { networkProperties } from '../__fixtures__/local/network';
import { runApiServiceTest } from '../test-utils';
import { NotFoundError } from 'wallet-common-core';

// Constants

const NODE_URL = networkProperties.nodeUrl;
const REGULAR_ADDRESS = regularAccountResponse.account.address;
const MULTISIG_ADDRESS = multisigAccountResponse.account.address;

const accountGetUrl = address => `${NODE_URL}/account/get?address=${address}`;
const definitionPageUrl = namespaceId => `${NODE_URL}/namespace/mosaic/definition/page?namespace=${namespaceId}&pageSize=100`;

// Request Maps

// A regular account whose owned mosaics resolve to the account mosaics fixture.
const regularRequestMap = {
	[accountGetUrl(REGULAR_ADDRESS)]: regularAccountResponse,
	[`${NODE_URL}/account/mosaic/owned?address=${REGULAR_ADDRESS}`]: { data: ownedMosaicDTOs },
	[definitionPageUrl('nem')]: { data: [] },
	[definitionPageUrl('test')]: { data: [{ mosaic: mosaicDefinitionDTO }] },
	[definitionPageUrl('unknown')]: { data: [] }
};

// A multisig account that owns no mosaics.
const multisigRequestMap = {
	[accountGetUrl(MULTISIG_ADDRESS)]: multisigAccountResponse,
	[`${NODE_URL}/account/mosaic/owned?address=${MULTISIG_ADDRESS}`]: { data: [] }
};

// The node does not know the account, so /account/get returns a 404.
const notFoundRequestMap = {
	[accountGetUrl(REGULAR_ADDRESS)]: new NotFoundError('Account not found')
};

describe('api/AccountService', () => {
	describe('fetchAccountInfo', () => {
		const runFetchAccountInfoTest = (description, config, expected) => {
			it(description, async () => {
				// Act & Assert:
				await runApiServiceTest({
					requestMap: config.requestMap,
					call: api => api.account.fetchAccountInfo(networkProperties, config.address),
					expected: expected.accountInfo
				});
			});
		};

		const fetchAccountInfoTests = [
			{
				description: 'assembles a regular account with its resolved mosaics and balance',
				config: { address: REGULAR_ADDRESS, requestMap: regularRequestMap },
				expected: { accountInfo }
			},
			{
				description: 'flags a multisig account and reports its cosignatories and minimum approval',
				config: { address: MULTISIG_ADDRESS, requestMap: multisigRequestMap },
				expected: { accountInfo: multisigAccountInfo }
			},
			{
				description: 'returns an empty account info when the account is not found',
				config: { address: REGULAR_ADDRESS, requestMap: notFoundRequestMap },
				expected: { accountInfo: notFoundAccountInfo }
			}
		];

		fetchAccountInfoTests.forEach(test => runFetchAccountInfoTest(test.description, test.config, test.expected));
	});

	describe('fetchAccountBalance', () => {
		it('fetches and converts the native balance to a relative amount', async () => {
			// Arrange:
			const requestMap = { [accountGetUrl(REGULAR_ADDRESS)]: regularAccountResponse };

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.account.fetchAccountBalance(networkProperties, REGULAR_ADDRESS),
				expected: accountInfo.balance
			});
		});
	});

	describe('fetchMultisigInfo', () => {
		it('fetches the cosignatories, multisig addresses and minimum approval', async () => {
			// Arrange:
			const requestMap = { [accountGetUrl(MULTISIG_ADDRESS)]: multisigAccountResponse };

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.account.fetchMultisigInfo(networkProperties, MULTISIG_ADDRESS),
				expected: multisigInfo
			});
		});
	});
});
