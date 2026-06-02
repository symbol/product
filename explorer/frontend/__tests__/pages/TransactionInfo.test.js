import '@testing-library/jest-dom';
import { transactionInfoResult, transactionPageResult } from '../test-utils/transactions';
import * as TransactionService from '@/api/transactions';
import { STORAGE_KEY } from '@/constants';
import TransactionInfo, { getServerSideProps } from '@/pages/transactions/[hash]';
import * as utils from '@/utils';
import { pageConfig } from '@/variants';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/utils', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils')
	};
});

jest.mock('@/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/transactions')
	};
});

jest.mock('@/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/transactions')
	};
});

beforeEach(() => {
	jest.spyOn(utils, 'useUserCurrencyAmount').mockReturnValue(1000);
});

const SYMBOL_TEST_SIGNER = 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY';
const SYMBOL_TEST_TARGET = 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ';
const SYMBOL_TEST_MOSAIC_ID = '72C0212E67A08BCE';
const SYMBOL_TEST_NAMESPACE_ID = 'D47D7DC85A201C13';

const createSymbolTransactionInfo = ({ type, detail, graphicTransaction, aggregate, hashLock }) => ({
	hash: 'A'.repeat(64),
	group: 'confirmed',
	type,
	version: 1,
	info: {
		transactionHash: 'A'.repeat(64),
		confirm: 'confirmed',
		signer: SYMBOL_TEST_SIGNER,
		blockHeight: 123,
		timestamp: '2021-03-16T00:06:26.000Z',
		deadline: '2021-03-16T00:06:26.000Z',
		effectiveFee: 0.0025,
		signature: 'C'.repeat(128),
		version: 1
	},
	detail: {
		transactionType: type,
		...detail
	},
	aggregate,
	hashLock,
	graphic: {
		transactions: graphicTransaction ? [graphicTransaction] : []
	}
});

const expectTextPresent = text => expect(screen.getAllByText(text).length).toBeGreaterThan(0);
const expectIconPresent = altText => expect(screen.getAllByAltText(altText).length).toBeGreaterThan(0);

describe('TransactionInfo', () => {
	describe('getServerSideProps', () => {
		const originalTransactionsPageConfig = { ...pageConfig.transactions };

		afterEach(() => {
			Object.assign(pageConfig.transactions, originalTransactionsPageConfig);
		});

		const runTest = async (transactionInfo, expectedResult) => {
			// Arrange:
			const locale = 'en';
			const params = { hash: transactionInfoResult.hash };
			const fetchTransactionInfo = jest.spyOn(TransactionService, 'fetchTransactionInfo');
			fetchTransactionInfo.mockResolvedValue(transactionInfo);

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchTransactionInfo).toHaveBeenCalledWith(params.hash);
			expect(result).toEqual(expectedResult);
		};

		it('returns transaction info', async () => {
			// Arrange:
			const transactionInfo = transactionInfoResult;
			const expectedResult = {
				props: {
					transactionInfo
				}
			};

			// Act + Assert:
			await runTest(transactionInfo, expectedResult);
		});

		it('returns not found', async () => {
			// Arrange:
			const transactionInfo = null;
			const expectedResult = {
				notFound: true
			};

			// Act + Assert:
			await runTest(transactionInfo, expectedResult);
		});

		it('returns not found without node request for invalid Symbol transaction hash', async () => {
			// Arrange:
			pageConfig.transactions.transactionHashPattern = '^[0-9A-Fa-f]{64}$';
			const fetchTransactionInfo = jest.spyOn(TransactionService, 'fetchTransactionInfo');

			// Act:
			const result = await getServerSideProps({
				locale: 'en',
				params: { hash: 'INVALID_HASH' }
			});

			// Assert:
			expect(result).toEqual({
				notFound: true
			});
			expect(fetchTransactionInfo).not.toHaveBeenCalled();
		});
	});

	describe('transaction information', () => {
		transactionPageResult.data.map((transactionInfo, index) => {
			it(`renders page with the information about the transaction ${index}`, () => {
				// Arrange:
				const pageSectionText = 'section_transaction';
				const hashText = transactionInfo.hash;
				const typeText = `transactionType_${transactionInfo.body[0].type}`;
				const signerText = transactionInfo.signer;
				const signatureText = transactionInfo.signature;

				// Act:
				render(<TransactionInfo transactionInfo={transactionInfo} />);

				// Assert:
				expect(screen.getByText(pageSectionText)).toBeInTheDocument();
				expect(screen.getByText(hashText)).toBeInTheDocument();
				expect(screen.getAllByText(typeText)[0]).toBeInTheDocument();
				expect(screen.getAllByText(signerText)[0]).toBeInTheDocument();
				expect(screen.getByText(signatureText)).toBeInTheDocument();
			});
		});

		it('renders page with the state change information', () => {
			// Act:
			render(<TransactionInfo transactionInfo={transactionInfoResult} />);

			// Assert:
			transactionInfoResult.accountStateChange.map((accountStateChange, index) => {
				const addressText = accountStateChange.address;
				const actionText = accountStateChange.action.map(action => `label_${action}`);
				const amountText = accountStateChange.mosaic.map(mosaic => Math.abs(mosaic.amount));

				expect(screen.getAllByText(addressText)[index]).toBeInTheDocument();
				actionText.map((action, actionIndex) => {
					expect(screen.getAllByText(action)[actionIndex]).toBeInTheDocument();
				});
				amountText.map((amount, amountIndex) => {
					expect(screen.getAllByText(amount)[amountIndex]).toBeInTheDocument();
				});
			});
		});

		it.each([
			[
				'ACCOUNT_KEY_LINK',
				{
					detail: {
						linkAction: 'link',
						linkedPublicKey: 'D'.repeat(64),
						linkedAccountAddress: SYMBOL_TEST_TARGET,
						address: SYMBOL_TEST_TARGET
					},
					graphicTransaction: {
						type: 'ACCOUNT_KEY_LINK',
						sender: SYMBOL_TEST_SIGNER,
						targetAccount: SYMBOL_TEST_TARGET,
						keyLinkAction: 1,
						publicKey: 'D'.repeat(64)
					},
					expectedTexts: ['field_target', 'field_publicKey']
				}
			],
			[
				'VRF_KEY_LINK',
				{
					detail: {
						linkAction: 'link',
						linkedPublicKey: 'E'.repeat(64),
						linkedAccountAddress: SYMBOL_TEST_TARGET,
						address: SYMBOL_TEST_TARGET
					},
					graphicTransaction: {
						type: 'VRF_KEY_LINK',
						sender: SYMBOL_TEST_SIGNER,
						targetAccount: SYMBOL_TEST_TARGET,
						keyLinkAction: 1,
						publicKey: 'E'.repeat(64)
					},
					expectedTexts: ['field_target', 'field_publicKey']
				}
			],
			[
				'VOTING_KEY_LINK',
				{
					detail: {
						linkAction: 'link',
						linkedPublicKey: 'F'.repeat(64),
						linkedAccountAddress: SYMBOL_TEST_TARGET,
						address: SYMBOL_TEST_TARGET,
						startEpoch: 10,
						endEpoch: 100
					},
					graphicTransaction: {
						type: 'VOTING_KEY_LINK',
						sender: SYMBOL_TEST_SIGNER,
						targetAccount: SYMBOL_TEST_TARGET,
						keyLinkAction: 1,
						publicKey: 'F'.repeat(64),
						startEpoch: 10,
						endEpoch: 100
					},
					expectedTexts: ['field_target', 'field_publicKey', 'field_startEpoch', 'field_endEpoch']
				}
			],
			[
				'NODE_KEY_LINK',
				{
					detail: {
						linkAction: 'link',
						linkedPublicKey: 'D'.repeat(64),
						linkedAccountAddress: SYMBOL_TEST_TARGET,
						address: SYMBOL_TEST_TARGET
					},
					graphicTransaction: {
						type: 'NODE_KEY_LINK',
						sender: SYMBOL_TEST_SIGNER,
						targetAccount: SYMBOL_TEST_TARGET,
						keyLinkAction: 1,
						publicKey: 'D'.repeat(64)
					},
					expectedTexts: ['field_target', 'field_publicKey']
				}
			],
			[
				'AGGREGATE_COMPLETE',
				{
					aggregate: {
						innerTransactions: [
							{
								transactionType: 'TRANSFER',
								signer: SYMBOL_TEST_SIGNER,
								detail: {
									transactionType: 'TRANSFER',
									recipient: SYMBOL_TEST_TARGET
								}
							}
						]
					},
					graphicTransaction: {
						type: 'TRANSFER',
						sender: SYMBOL_TEST_SIGNER,
						recipient: SYMBOL_TEST_TARGET
					},
					expectedTexts: ['section_innerTransactions', 'transactionType_TRANSFER']
				}
			],
			[
				'AGGREGATE_BONDED',
				{
					aggregate: {
						innerTransactions: [
							{
								transactionType: 'TRANSFER',
								signer: SYMBOL_TEST_SIGNER,
								detail: {
									transactionType: 'TRANSFER',
									recipient: SYMBOL_TEST_TARGET
								}
							}
						]
					},
					hashLock: {
						endHeight: 456,
						ownerAddress: SYMBOL_TEST_SIGNER,
						status: 'unused'
					},
					graphicTransaction: {
						type: 'TRANSFER',
						sender: SYMBOL_TEST_SIGNER,
						recipient: SYMBOL_TEST_TARGET
					},
					expectedTexts: ['section_innerTransactions', 'transactionType_TRANSFER', 'section_hashLock']
				}
			],
			[
				'MOSAIC_DEFINITION',
				{
					detail: {
						mosaicId: SYMBOL_TEST_MOSAIC_ID,
						divisibility: 6,
						duration: '0',
						nonce: 12345,
						supplyMutable: false,
						transferable: true,
						restrictable: true,
						revokable: true
					},
					graphicTransaction: {
						type: 'MOSAIC_DEFINITION',
						sender: SYMBOL_TEST_SIGNER,
						targetMosaic: {
							id: SYMBOL_TEST_MOSAIC_ID,
							name: SYMBOL_TEST_MOSAIC_ID
						},
						divisibility: 6,
						duration: '0',
						nonce: 12345,
						supplyMutable: false,
						transferable: true,
						restrictable: true,
						revokable: true
					},
					expectedTexts: ['field_divisibility', 'field_nonce', 'field_supplyMutable']
				}
			],
			[
				'MOSAIC_SUPPLY_CHANGE',
				{
					detail: {
						mosaicId: SYMBOL_TEST_MOSAIC_ID,
						action: 'increase',
						delta: '100'
					},
					graphicTransaction: {
						type: 'MOSAIC_SUPPLY_CHANGE',
						sender: SYMBOL_TEST_SIGNER,
						targetMosaic: {
							id: SYMBOL_TEST_MOSAIC_ID,
							name: SYMBOL_TEST_MOSAIC_ID
						},
						supplyAction: 1,
						delta: '100'
					},
					expectedTexts: ['field_targetMosaic', 'field_delta', 'value_supplyIncrease']
				}
			],
			[
				'MOSAIC_SUPPLY_REVOCATION',
				{
					detail: {
						address: SYMBOL_TEST_TARGET,
						mosaics: [{ mosaicId: SYMBOL_TEST_MOSAIC_ID, name: 'XYM', amount: 2 }]
					},
					graphicTransaction: {
						type: 'MOSAIC_SUPPLY_REVOCATION',
						sender: SYMBOL_TEST_TARGET,
						recipient: SYMBOL_TEST_SIGNER,
						mosaics: [{ id: SYMBOL_TEST_MOSAIC_ID, name: 'XYM', amount: 2 }]
					},
					expectedTexts: ['field_recipient', 'field_mosaics']
				}
			],
			[
				'NAMESPACE_REGISTRATION',
				{
					detail: {
						registrationType: 'sub',
						namespaceName: 'rootnamespace.subnamespace',
						namespaceId: SYMBOL_TEST_NAMESPACE_ID,
						parentId: '88A058DAA0940608',
						duration: '1000'
					},
					graphicTransaction: {
						type: 'NAMESPACE_REGISTRATION',
						sender: SYMBOL_TEST_SIGNER,
						targetNamespace: {
							id: SYMBOL_TEST_NAMESPACE_ID,
							name: 'rootnamespace.subnamespace'
						},
						registrationType: 'sub',
						parentId: '88A058DAA0940608',
						namespaceName: 'rootnamespace.subnamespace',
						namespaceId: SYMBOL_TEST_NAMESPACE_ID,
						duration: '1000'
					},
					expectedTexts: ['field_sink', 'field_registrationType', 'field_parentId', 'field_name']
				}
			],
			[
				'ADDRESS_ALIAS',
				{
					detail: {
						aliasAction: 'link',
						namespaceId: SYMBOL_TEST_NAMESPACE_ID,
						namespaceName: 'alias.name',
						address: SYMBOL_TEST_TARGET
					},
					graphicTransaction: {
						type: 'ADDRESS_ALIAS',
						sender: SYMBOL_TEST_SIGNER,
						recipient: SYMBOL_TEST_TARGET,
						aliasAction: 'link',
						namespaceId: SYMBOL_TEST_NAMESPACE_ID,
						namespaceName: 'alias.name'
					},
					expectedTexts: ['field_target', 'field_namespaceId', 'field_name']
				}
			],
			[
				'MOSAIC_ALIAS',
				{
					detail: {
						aliasAction: 'link',
						namespaceId: SYMBOL_TEST_NAMESPACE_ID,
						namespaceName: 'alias.mosaic',
						mosaicId: SYMBOL_TEST_MOSAIC_ID
					},
					graphicTransaction: {
						type: 'MOSAIC_ALIAS',
						sender: SYMBOL_TEST_SIGNER,
						targetMosaic: {
							id: SYMBOL_TEST_MOSAIC_ID,
							name: SYMBOL_TEST_MOSAIC_ID
						},
						aliasAction: 'link',
						namespaceId: SYMBOL_TEST_NAMESPACE_ID,
						namespaceName: 'alias.mosaic'
					},
					expectedTexts: ['field_target', 'field_namespaceId', 'field_name']
				}
			],
			[
				'ACCOUNT_METADATA',
				{
					detail: {
						targetAddress: SYMBOL_TEST_TARGET,
						scopedMetadataKey: 'BB3026E7612A769F',
						valueDelta: 'account metadata',
						valueSizeDelta: 16
					},
					graphicTransaction: {
						type: 'ACCOUNT_METADATA',
						sender: SYMBOL_TEST_SIGNER,
						targetAddress: SYMBOL_TEST_TARGET,
						scopedMetadataKey: 'BB3026E7612A769F',
						valueDelta: 'account metadata',
						valueSizeDelta: 16
					},
					expectedTexts: ['field_targetAddress', 'field_scopedMetadataKey', 'field_valueDelta']
				}
			],
			[
				'MOSAIC_METADATA',
				{
					detail: {
						targetMosaicId: SYMBOL_TEST_MOSAIC_ID,
						targetMosaicAliasNames: ['alias.mosaic'],
						scopedMetadataKey: 'BB3026E7612A769F',
						valueDelta: 'mosaic metadata',
						valueSizeDelta: 15
					},
					graphicTransaction: {
						type: 'MOSAIC_METADATA',
						sender: SYMBOL_TEST_SIGNER,
						targetMosaic: {
							id: SYMBOL_TEST_MOSAIC_ID,
							name: SYMBOL_TEST_MOSAIC_ID
						},
						targetMosaicAliasNames: ['alias.mosaic'],
						scopedMetadataKey: 'BB3026E7612A769F',
						valueDelta: 'mosaic metadata',
						valueSizeDelta: 15
					},
					expectedTexts: ['field_target', 'field_namespaceName', 'field_scopedMetadataKey']
				}
			],
			[
				'NAMESPACE_METADATA',
				{
					detail: {
						targetNamespaceId: SYMBOL_TEST_NAMESPACE_ID,
						namespaceName: 'root.namespace',
						scopedMetadataKey: 'BB3026E7612A769F',
						valueDelta: 'namespace metadata',
						valueSizeDelta: 18
					},
					graphicTransaction: {
						type: 'NAMESPACE_METADATA',
						sender: SYMBOL_TEST_SIGNER,
						targetNamespace: {
							id: SYMBOL_TEST_NAMESPACE_ID,
							name: SYMBOL_TEST_NAMESPACE_ID
						},
						namespaceName: 'root.namespace',
						scopedMetadataKey: 'BB3026E7612A769F',
						valueDelta: 'namespace metadata',
						valueSizeDelta: 18
					},
					expectedTexts: ['field_target', 'field_namespaceName', 'field_scopedMetadataKey']
				}
			],
			[
				'MULTISIG_ACCOUNT_MODIFICATION',
				{
					detail: {
						minApprovalDelta: 2,
						minRemovalDelta: 3,
						addressAdditions: [SYMBOL_TEST_TARGET],
						addressDeletions: ['TBPYGWB3O6VYRYQSUAS3BRYHSY6ASLIKAKTCLSQ']
					},
					graphicTransaction: {
						type: 'MULTISIG_ACCOUNT_MODIFICATION',
						sender: SYMBOL_TEST_SIGNER,
						targetAccount: SYMBOL_TEST_SIGNER,
						minApprovalDelta: 2,
						minRemovalDelta: 3,
						cosignatoryAdditions: [SYMBOL_TEST_TARGET],
						cosignatoryDeletions: ['TBPYGWB3O6VYRYQSUAS3BRYHSY6ASLIKAKTCLSQ']
					},
					expectedTexts: ['field_targetAccount', 'field_minApprovalDelta', 'field_minRemovalDelta']
				}
			],
			[
				'HASH_LOCK',
				{
					detail: {
						duration: '480',
						hash: 'B'.repeat(64),
						mosaics: [{ mosaicId: SYMBOL_TEST_MOSAIC_ID, name: 'XYM', amount: 10 }]
					},
					graphicTransaction: {
						type: 'HASH_LOCK',
						sender: SYMBOL_TEST_SIGNER,
						lockDuration: '480',
						hash: 'B'.repeat(64),
						mosaics: [{ id: SYMBOL_TEST_MOSAIC_ID, name: 'XYM', amount: 10 }]
					},
					expectedTexts: ['field_duration', '480 field_block', 'field_hash']
				}
			],
			[
				'SECRET_LOCK',
				{
					detail: {
						duration: '480',
						mosaics: [{ mosaicId: SYMBOL_TEST_MOSAIC_ID, name: 'XYM', amount: 10 }],
						secret: '2F2929A09DA25C7E2412128955D0BF073B1C2AA08BB6F254DC5E7BF9C323CE9A',
						recipient: SYMBOL_TEST_TARGET,
						hashAlgorithm: 'hash256'
					},
					graphicTransaction: {
						type: 'SECRET_LOCK',
						sender: SYMBOL_TEST_SIGNER,
						recipient: SYMBOL_TEST_TARGET,
						duration: '480',
						mosaics: [{ id: SYMBOL_TEST_MOSAIC_ID, name: 'XYM', amount: 10 }],
						secret: '2F2929A09DA25C7E2412128955D0BF073B1C2AA08BB6F254DC5E7BF9C323CE9A',
						hashAlgorithm: 'hash256'
					},
					expectedTexts: ['field_recipient', 'field_secret', 'secretLockHashAlgorithm_hash256']
				}
			],
			[
				'SECRET_PROOF',
				{
					detail: {
						recipient: SYMBOL_TEST_TARGET,
						hashAlgorithm: 'hash256',
						proof: 'AEAA'
					},
					graphicTransaction: {
						type: 'SECRET_PROOF',
						sender: SYMBOL_TEST_SIGNER,
						recipient: SYMBOL_TEST_TARGET,
						hashAlgorithm: 'hash256',
						proof: 'AEAA'
					},
					expectedTexts: ['field_proof', 'secretLockHashAlgorithm_hash256']
				}
			],
			[
				'ACCOUNT_ADDRESS_RESTRICTION',
				{
					detail: {
						restrictionType: 'Block Incoming Address',
						restrictionAddressAdditions: [SYMBOL_TEST_TARGET]
					},
					graphicTransaction: {
						type: 'ACCOUNT_ADDRESS_RESTRICTION',
						sender: SYMBOL_TEST_SIGNER,
						targetAccount: SYMBOL_TEST_SIGNER,
						restrictionType: 'Block Incoming Address',
						restrictionAddressAdditions: [SYMBOL_TEST_TARGET]
					},
					expectedTexts: ['field_targetAccount', 'field_restrictionType', 'field_restrictionAddressAdditions']
				}
			],
			[
				'ACCOUNT_MOSAIC_RESTRICTION',
				{
					detail: {
						restrictionType: 'Block Incoming Mosaic',
						restrictionMosaicAdditions: [SYMBOL_TEST_MOSAIC_ID]
					},
					graphicTransaction: {
						type: 'ACCOUNT_MOSAIC_RESTRICTION',
						sender: SYMBOL_TEST_SIGNER,
						targetAccount: SYMBOL_TEST_SIGNER,
						restrictionType: 'Block Incoming Mosaic',
						restrictionMosaicAdditions: [SYMBOL_TEST_MOSAIC_ID]
					},
					expectedTexts: ['field_targetAccount', 'field_restrictionType', 'field_restrictionMosaicAdditions']
				}
			],
			[
				'ACCOUNT_OPERATION_RESTRICTION',
				{
					detail: {
						restrictionType: 'Block Incoming Operation',
						restrictionOperationAdditions: ['TRANSFER', 'HASH_LOCK']
					},
					graphicTransaction: {
						type: 'ACCOUNT_OPERATION_RESTRICTION',
						sender: SYMBOL_TEST_SIGNER,
						targetAccount: SYMBOL_TEST_SIGNER,
						restrictionType: 'Block Incoming Operation',
						restrictionOperationAdditions: ['TRANSFER', 'HASH_LOCK']
					},
					expectedTexts: ['field_targetAccount', 'field_restrictionType', 'field_restrictionOperationAdditions']
				}
			],
			[
				'MOSAIC_GLOBAL_RESTRICTION',
				{
					detail: {
						mosaicId: SYMBOL_TEST_MOSAIC_ID,
						referenceMosaicId: SYMBOL_TEST_MOSAIC_ID,
						mosaicAliasNames: [],
						restrictionKey: '123',
						previousRestrictionType: 'No Restriction',
						previousRestrictionValue: '0',
						newRestrictionType: 'Greater Than Or Equal',
						newRestrictionValue: '100'
					},
					graphicTransaction: {
						type: 'MOSAIC_GLOBAL_RESTRICTION',
						sender: SYMBOL_TEST_SIGNER,
						targetMosaic: {
							id: SYMBOL_TEST_MOSAIC_ID,
							name: SYMBOL_TEST_MOSAIC_ID
						},
						referenceMosaicId: SYMBOL_TEST_MOSAIC_ID,
						mosaicAliasNames: [],
						restrictionKey: '123',
						previousRestrictionType: 'No Restriction',
						previousRestrictionValue: '0',
						newRestrictionType: 'Greater Than Or Equal',
						newRestrictionValue: '100'
					},
					expectedTexts: ['field_target', 'field_referenceMosaicId', 'table_field_alias']
				}
			],
			[
				'MOSAIC_ADDRESS_RESTRICTION',
				{
					detail: {
						mosaicId: SYMBOL_TEST_MOSAIC_ID,
						mosaicAliasNames: ['alias.mosaic'],
						targetAddress: SYMBOL_TEST_TARGET,
						restrictionKey: '123',
						previousRestrictionValue: '0',
						newRestrictionValue: '100'
					},
					graphicTransaction: {
						type: 'MOSAIC_ADDRESS_RESTRICTION',
						sender: SYMBOL_TEST_SIGNER,
						targetMosaic: {
							id: SYMBOL_TEST_MOSAIC_ID,
							name: SYMBOL_TEST_MOSAIC_ID
						},
						mosaicAliasNames: ['alias.mosaic'],
						targetAddress: SYMBOL_TEST_TARGET,
						restrictionKey: '123',
						previousRestrictionValue: '0',
						newRestrictionValue: '100'
					},
					expectedTexts: ['field_target', 'field_mosaicId', 'table_field_alias', 'field_targetAddress']
				}
			],
			[
				'TRANSFER',
				{
					detail: {
						recipient: SYMBOL_TEST_TARGET,
						mosaics: [{ mosaicId: SYMBOL_TEST_MOSAIC_ID, name: 'XYM', amount: 1 }],
						message: { type: 'plain', text: 'Hello Symbol' }
					},
					graphicTransaction: {
						type: 'TRANSFER',
						sender: SYMBOL_TEST_SIGNER,
						recipient: SYMBOL_TEST_TARGET,
						mosaics: [{ id: SYMBOL_TEST_MOSAIC_ID, name: 'XYM', amount: 1 }],
						message: { type: 'plain', text: 'Hello Symbol' }
					},
					expectedTexts: ['field_recipient', 'field_mosaics', 'field_message', 'Hello Symbol']
				}
			]
		])('directly renders Symbol Transaction Detail for %s', (type, { expectedTexts, ...transactionInfoInput }) => {
			// Arrange:
			const transactionInfo = createSymbolTransactionInfo({
				type,
				detail: {},
				...transactionInfoInput
			});

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			expectTextPresent('section_transactionDetail');
			expectTextPresent(`transactionType_${type}`);
			expectIconPresent(type);
			expectedTexts.forEach(expectTextPresent);
		});

		it('renders account metadata target and metadata fields without raw HTML rendering', () => {
			// Arrange:
			const signer = 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY';
			const targetAddress = 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ';
			const valueDelta = '<strong>metadata</strong>';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'ACCOUNT_METADATA',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'ACCOUNT_METADATA',
					targetAddress,
					scopedMetadataKey: 'BB3026E7612A769F',
					valueDelta,
					valueSizeDelta: 8
				},
				graphic: {
					transactions: [
						{
							type: 'ACCOUNT_METADATA',
							sender: signer,
							targetAddress,
							scopedMetadataKey: 'BB3026E7612A769F',
							valueDelta,
							valueSizeDelta: 8
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			expect(screen.getByText('section_transactionDetail')).toBeInTheDocument();
			expect(screen.queryByText('section_transactionGraphic')).not.toBeInTheDocument();
			expect(screen.getByText('field_targetAddress')).toBeInTheDocument();
			expect(screen.getByText(targetAddress)).toBeInTheDocument();
			expect(screen.getByText('field_scopedMetadataKey')).toBeInTheDocument();
			expect(screen.getByText('BB3026E7612A769F')).toBeInTheDocument();
			expect(screen.getByText('field_valueDelta')).toBeInTheDocument();
			expect(screen.getByText(valueDelta)).toBeInTheDocument();
			expect(screen.getByText('field_valueSizeDelta')).toBeInTheDocument();
			expect(screen.getByText('8')).toBeInTheDocument();
			expect(screen.queryByText('field_metadataValue')).not.toBeInTheDocument();
			expect(screen.queryByText('metadata')).not.toBeInTheDocument();
		});

		it('renders namespace metadata target namespace and namespace name first', () => {
			// Arrange:
			const namespaceId = '85BBEA6CC462B244';
			const namespaceName = 'root.namespace';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'NAMESPACE_METADATA',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'NAMESPACE_METADATA',
					targetNamespaceId: namespaceId,
					namespaceName,
					scopedMetadataKey: 'BB3026E7612A769F',
					valueDelta: 'namespace metadata',
					valueSizeDelta: 18
				},
				graphic: {
					transactions: [
						{
							type: 'NAMESPACE_METADATA',
							sender: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
							targetNamespace: {
								id: namespaceId,
								name: namespaceId
							},
							namespaceName,
							scopedMetadataKey: 'BB3026E7612A769F',
							valueDelta: 'namespace metadata',
							valueSizeDelta: 18
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const namespaceNameField = screen.getByText('field_namespaceName');
			const scopedMetadataKeyField = screen.getByText('field_scopedMetadataKey');

			expect(screen.getByText('field_target')).toBeInTheDocument();
			expect(screen.getByText(namespaceId)).toBeInTheDocument();
			expect(namespaceNameField).toBeInTheDocument();
			expect(screen.getByText(namespaceName)).toBeInTheDocument();
			expect(namespaceNameField.compareDocumentPosition(scopedMetadataKeyField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('field_valueDelta')).toBeInTheDocument();
			expect(screen.getByText('namespace metadata')).toBeInTheDocument();
			expect(screen.getByText('field_valueSizeDelta')).toBeInTheDocument();
			expect(screen.queryByText('field_targetNamespaceId')).not.toBeInTheDocument();
		});

		it.each([
			[['alias.mosaic'], 'alias.mosaic'],
			[[], 'N/A']
		])('renders mosaic metadata target mosaic and namespace name %s', (targetMosaicAliasNames, expectedNamespaceName) => {
			// Arrange:
			const mosaicId = '72C0212E67A08BCE';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'MOSAIC_METADATA',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'MOSAIC_METADATA',
					targetMosaicId: mosaicId,
					targetMosaicAliasNames,
					scopedMetadataKey: 'BB3026E7612A769F',
					valueDelta: 'mosaic metadata',
					valueSizeDelta: 15
				},
				graphic: {
					transactions: [
						{
							type: 'MOSAIC_METADATA',
							sender: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
							targetMosaic: {
								id: mosaicId,
								name: mosaicId
							},
							targetMosaicAliasNames,
							scopedMetadataKey: 'BB3026E7612A769F',
							valueDelta: 'mosaic metadata',
							valueSizeDelta: 15
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			expect(screen.getByText('field_target')).toBeInTheDocument();
			expect(screen.getByText(mosaicId)).toBeInTheDocument();
			expect(screen.getByText('field_namespaceName')).toBeInTheDocument();
			expect(screen.getByText(expectedNamespaceName)).toBeInTheDocument();
			expect(screen.getByText('field_scopedMetadataKey')).toBeInTheDocument();
			expect(screen.getByText('field_valueDelta')).toBeInTheDocument();
			expect(screen.getByText('field_valueSizeDelta')).toBeInTheDocument();
			expect(screen.queryByText('field_targetMosaicId')).not.toBeInTheDocument();
			expect(screen.queryByText('field_targetMosaicAliasNames')).not.toBeInTheDocument();
		});

		it('renders Secret Proof proof label and hash algorithm display label', () => {
			// Arrange:
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'SECRET_PROOF',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'SECRET_PROOF',
					hashAlgorithm: 'hash256',
					proof: 'AEAA'
				},
				graphic: {
					transactions: [
						{
							type: 'SECRET_PROOF',
							sender: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
							hashAlgorithm: 'hash256',
							proof: 'AEAA'
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			expect(screen.getByText('field_proof')).toBeInTheDocument();
			expect(screen.getByText('secretLockHashAlgorithm_hash256')).toBeInTheDocument();
			expect(screen.getAllByText('AEAA')).toHaveLength(1);
		});

		it('renders Secret Lock transaction detail fields', () => {
			// Arrange:
			const signer = 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY';
			const recipient = 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ';
			const secret = '2F2929A09DA25C7E2412128955D0BF073B1C2AA08BB6F254DC5E7BF9C323CE9A';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'SECRET_LOCK',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'SECRET_LOCK',
					duration: '480',
					mosaics: [
						{
							mosaicId: '72C0212E67A08BCE',
							name: 'XYM',
							amount: 10
						}
					],
					secret,
					recipient,
					hashAlgorithm: 'hash256'
				},
				graphic: {
					transactions: [
						{
							type: 'SECRET_LOCK',
							sender: signer,
							recipient,
							duration: '480',
							mosaics: [
								{
									id: '72C0212E67A08BCE',
									name: 'XYM',
									amount: 10
								}
							],
							secret,
							hashAlgorithm: 'hash256'
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			expect(screen.getAllByText('transactionType_SECRET_LOCK')).not.toHaveLength(0);
			expect(screen.getByText('field_recipient')).toBeInTheDocument();
			expect(screen.getByText(recipient)).toBeInTheDocument();
			expect(screen.getByText('field_duration')).toBeInTheDocument();
			expect(screen.getByText('480')).toBeInTheDocument();
			expect(screen.getByText('field_mosaics')).toBeInTheDocument();
			expect(screen.getByText('field_hashAlgorithm')).toBeInTheDocument();
			expect(screen.getByText('secretLockHashAlgorithm_hash256')).toBeInTheDocument();
			expect(screen.getByText('field_secret')).toBeInTheDocument();
			expect(screen.getByText(secret)).toBeInTheDocument();
		});

		it('renders plain transaction detail message as visible text', () => {
			// Arrange:
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'TRANSFER',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'TRANSFER',
					message: {
						type: 'plain',
						text: 'Hello Symbol'
					}
				},
				graphic: {
					transactions: [
						{
							type: 'TRANSFER',
							sender: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
							message: {
								type: 'plain',
								text: 'Hello Symbol'
							}
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			expect(screen.getAllByText('Hello Symbol')).toHaveLength(1);
		});

		it('renders encrypted transaction detail message with the message renderer', () => {
			// Arrange:
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'TRANSFER',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'TRANSFER',
					message: {
						type: 'encrypted'
					}
				},
				graphic: {
					transactions: [
						{
							type: 'TRANSFER',
							sender: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
							message: {
								type: 'encrypted'
							}
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);
			const messageIcon = screen.getByAltText('Message');
			fireEvent.focus(messageIcon.closest('span'));

			// Assert:
			expect(screen.getByText('field_message')).toBeInTheDocument();
			expect(messageIcon).toBeInTheDocument();
			expect(screen.getByRole('tooltip')).toHaveTextContent('Encrypted message');
			expect(screen.queryByText('undefined')).not.toBeInTheDocument();
		});

		it('renders hash lock duration in the graphic and hash below duration', () => {
			// Arrange:
			const signer = 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY';
			const lockedHash = 'B'.repeat(64);
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'HASH_LOCK',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'HASH_LOCK',
					duration: '480',
					hash: lockedHash,
					mosaics: [
						{
							mosaicId: '72C0212E67A08BCE',
							name: 'XYM',
							amount: 10
						}
					]
				},
				graphic: {
					transactions: [
						{
							type: 'HASH_LOCK',
							sender: signer,
							duration: '480',
							lockDuration: '480',
							hash: lockedHash,
							mosaics: [
								{
									id: '72C0212E67A08BCE',
									name: 'XYM',
									amount: 10
								}
							]
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const hashField = screen.getByText('field_hash');

			expect(screen.getAllByText('field_duration')).toHaveLength(1);
			expect(screen.getByText('480 field_block')).toBeInTheDocument();
			expect(screen.getByAltText('Lock')).toBeInTheDocument();
			expect(screen.getByText('field_mosaics')).toBeInTheDocument();
			expect(hashField).toBeInTheDocument();
			expect(screen.getAllByText(lockedHash)).toHaveLength(1);
		});

		it('renders mosaic supply revocation target address as sender and signer as recipient', () => {
			// Arrange:
			const signer = 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY';
			const targetAddress = 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'MOSAIC_SUPPLY_REVOCATION',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'MOSAIC_SUPPLY_REVOCATION',
					address: targetAddress,
					mosaics: [
						{
							mosaicId: '72C0212E67A08BCE',
							name: 'XYM',
							amount: 2
						}
					]
				},
				graphic: {
					transactions: [
						{
							type: 'MOSAIC_SUPPLY_REVOCATION',
							sender: targetAddress,
							recipient: signer,
							address: targetAddress,
							mosaics: [
								{
									id: '72C0212E67A08BCE',
									name: 'XYM',
									amount: 2
								}
							]
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			expect(screen.getByText('field_sender')).toBeInTheDocument();
			expect(screen.getByText('field_recipient')).toBeInTheDocument();
			expect(screen.getByText('field_mosaics')).toBeInTheDocument();
			expect(screen.queryByText('field_address')).not.toBeInTheDocument();
			expect(screen.getAllByText(targetAddress)).toHaveLength(1);
			expect(screen.getAllByText(signer)).toHaveLength(2);
		});

		it('renders mosaic definition nonce and flags in the graphic only', () => {
			// Arrange:
			const signer = 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'MOSAIC_DEFINITION',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'MOSAIC_DEFINITION',
					mosaicId: '72C0212E67A08BCE',
					divisibility: 6,
					duration: '0',
					nonce: 12345,
					supplyMutable: false,
					transferable: true,
					restrictable: true,
					revokable: true
				},
				graphic: {
					transactions: [
						{
							type: 'MOSAIC_DEFINITION',
							sender: signer,
							targetMosaic: {
								id: '72C0212E67A08BCE',
								name: '72C0212E67A08BCE'
							},
							divisibility: 6,
							duration: '0',
							nonce: 12345,
							supplyMutable: false,
							transferable: true,
							restrictable: true,
							revokable: true
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const divisibilityField = screen.getByText('field_divisibility');
			const durationField = screen.getByText('field_duration');
			const nonceField = screen.getByText('field_nonce');
			const supplyMutableField = screen.getByText('field_supplyMutable');
			const transferableField = screen.getByText('field_transferable');
			const restrictableField = screen.getByText('field_restrictable');
			const revokableField = screen.getByText('field_revokable');

			expect(divisibilityField.compareDocumentPosition(durationField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(durationField.compareDocumentPosition(nonceField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(nonceField.compareDocumentPosition(supplyMutableField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(supplyMutableField.compareDocumentPosition(transferableField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(transferableField.compareDocumentPosition(restrictableField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(restrictableField.compareDocumentPosition(revokableField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('false')).toBeInTheDocument();
			expect(screen.getAllByText('true')).toHaveLength(3);
		});

		it('renders mosaic supply change action and delta in the graphic only', () => {
			// Arrange:
			const signer = 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'MOSAIC_SUPPLY_CHANGE',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'MOSAIC_SUPPLY_CHANGE',
					mosaicId: '72C0212E67A08BCE',
					action: 'increase',
					delta: '100'
				},
				graphic: {
					transactions: [
						{
							type: 'MOSAIC_SUPPLY_CHANGE',
							sender: signer,
							targetMosaic: {
								id: '72C0212E67A08BCE',
								name: '72C0212E67A08BCE'
							},
							supplyAction: 1,
							delta: '100'
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			expect(screen.getByText('field_delta')).toBeInTheDocument();
			expect(screen.getByText('+100')).toBeInTheDocument();
			expect(screen.getByText('field_supplyAction')).toBeInTheDocument();
			expect(screen.getByText('value_supplyIncrease')).toBeInTheDocument();
			expect(screen.queryByText('field_action')).not.toBeInTheDocument();
		});

		it('renders full sender and recipient addresses in the transaction detail graphic', async () => {
			// Arrange:
			const sender = 'TAA3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYAA';
			const recipient = 'TBB3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYBB';
			localStorage.setItem(
				STORAGE_KEY.ADDRESS_BOOK,
				JSON.stringify([
					{
						address: sender,
						name: 'Sender Name'
					},
					{
						address: recipient,
						name: 'Recipient Name'
					}
				])
			);
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'TRANSFER',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer: sender,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'TRANSFER',
					recipient
				},
				graphic: {
					transactions: [
						{
							type: 'TRANSFER',
							sender,
							recipient
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			await waitFor(() => expect(screen.getByText(/Sender Name/)).toBeInTheDocument());
			expect(screen.getByText(sender)).toBeInTheDocument();
			expect(screen.getByText(recipient)).toBeInTheDocument();
			expect(screen.queryByText(/Recipient Name/)).not.toBeInTheDocument();
		});

		it.each(['ACCOUNT_KEY_LINK', 'NODE_KEY_LINK', 'VRF_KEY_LINK'])(
			'renders %s linked account address as target graphic without address detail',
			transactionType => {
				// Arrange:
				const signer = 'TCC3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYCC';
				const targetAddress = 'TDD3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYDD';
				const transactionInfo = {
					hash: 'A'.repeat(64),
					group: 'confirmed',
					type: transactionType,
					version: 1,
					info: {
						transactionHash: 'A'.repeat(64),
						confirm: 'confirmed',
						signer,
						blockHeight: 123,
						timestamp: '2021-03-16T00:06:26.000Z',
						deadline: '2021-03-16T00:06:26.000Z',
						effectiveFee: 0.0025,
						signature: 'C'.repeat(128),
						version: 1
					},
					detail: {
						transactionType,
						linkAction: 'link',
						linkedPublicKey: 'D'.repeat(64),
						linkedAccountAddress: targetAddress,
						address: targetAddress
					},
					graphic: {
						transactions: [
							{
								type: transactionType,
								sender: signer,
								targetAccount: targetAddress,
								keyLinkAction: 1,
								publicKey: 'D'.repeat(64)
							}
						]
					}
				};

				// Act:
				render(<TransactionInfo transactionInfo={transactionInfo} />);

				// Assert:
				const publicKeyField = screen.getByText('field_publicKey');

				expect(screen.getByText('field_target')).toBeInTheDocument();
				expect(screen.queryByText('field_recipient')).not.toBeInTheDocument();
				expect(screen.queryByText('field_targetAccount')).not.toBeInTheDocument();
				expect(screen.queryByText('field_address')).not.toBeInTheDocument();
				expect(publicKeyField).toBeInTheDocument();
				expect(screen.getAllByText(signer)).toHaveLength(2);
				expect(screen.getAllByText(targetAddress)).toHaveLength(1);
			}
		);

		it('renders voting key link target account as target graphic and epochs below public key', () => {
			// Arrange:
			const signer = 'TCC3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYCC';
			const targetAddress = 'TEE3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYEE';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'VOTING_KEY_LINK',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'VOTING_KEY_LINK',
					linkAction: 'link',
					linkedPublicKey: 'D'.repeat(64),
					linkedAccountAddress: targetAddress,
					address: targetAddress,
					startEpoch: 10,
					endEpoch: 100
				},
				graphic: {
					transactions: [
						{
							type: 'VOTING_KEY_LINK',
							sender: signer,
							targetAccount: targetAddress,
							keyLinkAction: 1,
							publicKey: 'D'.repeat(64),
							startEpoch: 10,
							endEpoch: 100
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const publicKeyField = screen.getByText('field_publicKey');
			const startEpochField = screen.getByText('field_startEpoch');
			const endEpochField = screen.getByText('field_endEpoch');

			expect(screen.getByText('field_target')).toBeInTheDocument();
			expect(screen.queryByText('field_recipient')).not.toBeInTheDocument();
			expect(screen.queryByText('field_address')).not.toBeInTheDocument();
			expect(publicKeyField.compareDocumentPosition(startEpochField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(startEpochField.compareDocumentPosition(endEpochField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getAllByText(signer)).toHaveLength(2);
			expect(screen.getAllByText(targetAddress)).toHaveLength(1);
		});

		it('renders account address restriction target and labeled restriction type in the graphic only', () => {
			// Arrange:
			const signer = 'TFF3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYFF';
			const restrictedAddress = 'TGG3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYGG';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'ACCOUNT_ADDRESS_RESTRICTION',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'ACCOUNT_ADDRESS_RESTRICTION',
					restrictionType: 'Block Incoming Address',
					restrictionAddressAdditions: [restrictedAddress]
				},
				graphic: {
					transactions: [
						{
							type: 'ACCOUNT_ADDRESS_RESTRICTION',
							sender: signer,
							targetAccount: signer,
							restrictionType: 'Block Incoming Address',
							restrictionAddressAdditions: [restrictedAddress]
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const restrictionTypeField = screen.getByText('field_restrictionType');
			const addressAdditionsField = screen.getByText('field_restrictionAddressAdditions');

			expect(screen.getByText('field_targetAccount')).toBeInTheDocument();
			expect(screen.getByText('Block Incoming Address')).toBeInTheDocument();
			expect(restrictionTypeField.compareDocumentPosition(addressAdditionsField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getAllByText(signer)).toHaveLength(3);
			expect(screen.getAllByText(restrictedAddress)).toHaveLength(1);
			expect(screen.queryByText('field_restrictionMosaicAdditions')).not.toBeInTheDocument();
			expect(screen.queryByText('field_restrictionOperationAdditions')).not.toBeInTheDocument();
		});

		it('renders account mosaic restriction target and additions below restriction type in the graphic only', () => {
			// Arrange:
			const signer = 'TFF3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYFF';
			const restrictedMosaicId = '72C0212E67A08BCE';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'ACCOUNT_MOSAIC_RESTRICTION',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'ACCOUNT_MOSAIC_RESTRICTION',
					restrictionType: 'Block Incoming Mosaic',
					restrictionMosaicAdditions: [restrictedMosaicId]
				},
				graphic: {
					transactions: [
						{
							type: 'ACCOUNT_MOSAIC_RESTRICTION',
							sender: signer,
							targetAccount: signer,
							restrictionType: 'Block Incoming Mosaic',
							restrictionMosaicAdditions: [restrictedMosaicId]
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const restrictionTypeField = screen.getByText('field_restrictionType');
			const mosaicAdditionsField = screen.getByText('field_restrictionMosaicAdditions');

			expect(screen.getByText('field_targetAccount')).toBeInTheDocument();
			expect(screen.getByText('Block Incoming Mosaic')).toBeInTheDocument();
			expect(restrictionTypeField.compareDocumentPosition(mosaicAdditionsField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getAllByText(signer)).toHaveLength(3);
			expect(screen.getAllByText(restrictedMosaicId)).toHaveLength(1);
			expect(screen.queryByText('field_restrictionAddressAdditions')).not.toBeInTheDocument();
			expect(screen.queryByText('field_restrictionOperationAdditions')).not.toBeInTheDocument();
		});

		it('renders account operation restriction target and enum values below restriction type in the graphic only', () => {
			// Arrange:
			const signer = 'TFF3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYFF';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'ACCOUNT_OPERATION_RESTRICTION',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'ACCOUNT_OPERATION_RESTRICTION',
					restrictionType: 'Block Incoming Operation',
					restrictionOperationAdditions: ['TRANSFER', 'HASH_LOCK']
				},
				graphic: {
					transactions: [
						{
							type: 'ACCOUNT_OPERATION_RESTRICTION',
							sender: signer,
							targetAccount: signer,
							restrictionType: 'Block Incoming Operation',
							restrictionOperationAdditions: ['TRANSFER', 'HASH_LOCK']
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const restrictionTypeField = screen.getByText('field_restrictionType');
			const operationAdditionsField = screen.getByText('field_restrictionOperationAdditions');

			expect(screen.getByText('field_targetAccount')).toBeInTheDocument();
			expect(screen.getByText('Block Incoming Operation')).toBeInTheDocument();
			expect(restrictionTypeField.compareDocumentPosition(operationAdditionsField))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getAllByText(signer)).toHaveLength(3);
			expect(screen.getByText('transactionType_TRANSFER')).toBeInTheDocument();
			expect(screen.getByText('transactionType_HASH_LOCK')).toBeInTheDocument();
			expect(screen.queryByText('field_restrictionAddressAdditions')).not.toBeInTheDocument();
			expect(screen.queryByText('field_restrictionMosaicAdditions')).not.toBeInTheDocument();
		});

		it('renders address alias linked address as target without address detail', () => {
			// Arrange:
			const signer = 'TFF3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYFF';
			const linkedAddress = 'TGG3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYGG';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'ADDRESS_ALIAS',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'ADDRESS_ALIAS',
					aliasAction: 'link',
					namespaceId: 'D47D7DC85A201C13',
					namespaceName: 'alias.name',
					address: linkedAddress
				},
				graphic: {
					transactions: [
						{
							type: 'ADDRESS_ALIAS',
							sender: signer,
							recipient: linkedAddress,
							aliasAction: 'link',
							namespaceId: 'D47D7DC85A201C13',
							namespaceName: 'alias.name'
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const namespaceIdField = screen.getByText('field_namespaceId');
			const nameField = screen.getByText('field_name');

			expect(screen.getByText('field_target')).toBeInTheDocument();
			expect(screen.queryByText('field_recipient')).not.toBeInTheDocument();
			expect(screen.queryByText('field_address')).not.toBeInTheDocument();
			expect(screen.getAllByText(linkedAddress)).toHaveLength(1);
			expect(namespaceIdField.compareDocumentPosition(nameField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getAllByText('alias.name')).toHaveLength(1);
		});

		it('renders namespace registration namespace name as sink and duration last', () => {
			// Arrange:
			const signer = 'THH3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYHH';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'NAMESPACE_REGISTRATION',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'NAMESPACE_REGISTRATION',
					registrationType: 'sub',
					namespaceName: 'rootnamespace.subnamespace',
					namespaceId: 'A8A057CA90B40609',
					parentId: '88A058DAA0940608',
					duration: '1000'
				},
				graphic: {
					transactions: [
						{
							type: 'NAMESPACE_REGISTRATION',
							sender: signer,
							targetNamespace: {
								id: 'A8A057CA90B40609',
								name: 'rootnamespace.subnamespace'
							},
							registrationType: 'sub',
							parentId: '88A058DAA0940608',
							namespaceName: 'rootnamespace.subnamespace',
							namespaceId: 'A8A057CA90B40609',
							duration: '1000'
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const registrationTypeField = screen.getByText('field_registrationType');
			const parentIdField = screen.getByText('field_parentId');
			const nameField = screen.getByText('field_name');
			const durationField = screen.getByText('field_duration');

			expect(screen.getByText('field_sink')).toBeInTheDocument();
			expect(screen.getAllByText('rootnamespace.subnamespace')).not.toHaveLength(0);
			expect(registrationTypeField.compareDocumentPosition(parentIdField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(parentIdField.compareDocumentPosition(nameField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(nameField.compareDocumentPosition(durationField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		});

		it('renders mosaic alias target mosaic without mosaic id detail', () => {
			// Arrange:
			const signer = 'THH3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYHH';
			const mosaicId = '72C0212E67A08BCE';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'MOSAIC_ALIAS',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'MOSAIC_ALIAS',
					aliasAction: 'link',
					namespaceId: 'D47D7DC85A201C13',
					namespaceName: 'alias.mosaic',
					mosaicId
				},
				graphic: {
					transactions: [
						{
							type: 'MOSAIC_ALIAS',
							sender: signer,
							targetMosaic: {
								id: mosaicId,
								name: mosaicId
							},
							aliasAction: 'link',
							namespaceId: 'D47D7DC85A201C13',
							namespaceName: 'alias.mosaic',
							mosaicId
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			expect(screen.getByText('field_target')).toBeInTheDocument();
			expect(screen.queryByText('field_mosaicId')).not.toBeInTheDocument();
			expect(screen.getAllByText('alias.mosaic')).toHaveLength(1);
			expect(screen.getAllByText(mosaicId)).not.toHaveLength(0);
		});

		it('renders mosaic address restriction alias and target address in the graphic', () => {
			// Arrange:
			const signer = 'THH3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYHH';
			const targetAddress = 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ';
			const mosaicId = '72C0212E67A08BCE';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'MOSAIC_ADDRESS_RESTRICTION',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'MOSAIC_ADDRESS_RESTRICTION',
					mosaicId,
					mosaicAliasNames: ['alias.mosaic'],
					targetAddress,
					restrictionKey: '123',
					previousRestrictionValue: '0',
					newRestrictionValue: '100'
				},
				graphic: {
					transactions: [
						{
							type: 'MOSAIC_ADDRESS_RESTRICTION',
							sender: signer,
							targetMosaic: {
								id: mosaicId,
								name: mosaicId
							},
							mosaicAliasNames: ['alias.mosaic'],
							targetAddress,
							restrictionKey: '123',
							previousRestrictionValue: '0',
							newRestrictionValue: '100'
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const mosaicIdField = screen.getByText('field_mosaicId');
			const aliasField = screen.getByText('table_field_alias');
			const targetAddressField = screen.getByText('field_targetAddress');

			expect(screen.getByText('field_target')).toBeInTheDocument();
			expect(screen.queryByText('field_recipient')).not.toBeInTheDocument();
			expect(mosaicIdField.compareDocumentPosition(aliasField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(aliasField.compareDocumentPosition(targetAddressField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('alias.mosaic')).toBeInTheDocument();
			expect(screen.getByText(targetAddress)).toBeInTheDocument();
			expect(screen.getAllByText(mosaicId)).not.toHaveLength(0);
		});

		it('renders mosaic global restriction target mosaic and restriction detail in the graphic', () => {
			// Arrange:
			const signer = 'THH3NCTW7VJM4YNXLH7QYUAE6HPIHGCVYP7BYHH';
			const mosaicId = '72C0212E67A08BCE';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'MOSAIC_GLOBAL_RESTRICTION',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer,
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'MOSAIC_GLOBAL_RESTRICTION',
					mosaicId,
					referenceMosaicId: mosaicId,
					mosaicAliasNames: [],
					restrictionKey: '123',
					previousRestrictionType: 'No Restriction',
					previousRestrictionValue: '0',
					newRestrictionType: 'Greater Than Or Equal',
					newRestrictionValue: '100'
				},
				graphic: {
					transactions: [
						{
							type: 'MOSAIC_GLOBAL_RESTRICTION',
							sender: signer,
							targetMosaic: {
								id: mosaicId,
								name: mosaicId
							},
							referenceMosaicId: mosaicId,
							mosaicAliasNames: [],
							restrictionKey: '123',
							previousRestrictionType: 'No Restriction',
							previousRestrictionValue: '0',
							newRestrictionType: 'Greater Than Or Equal',
							newRestrictionValue: '100'
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const referenceMosaicIdField = screen.getByText('field_referenceMosaicId');
			const aliasField = screen.getByText('table_field_alias');
			const previousRestrictionTypeField = screen.getByText('field_previousRestrictionType');
			const newRestrictionTypeField = screen.getByText('field_newRestrictionType');

			expect(screen.getByText('field_target')).toBeInTheDocument();
			expect(screen.queryByText('field_recipient')).not.toBeInTheDocument();
			expect(referenceMosaicIdField.compareDocumentPosition(aliasField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('N/A')).toBeInTheDocument();
			expect(previousRestrictionTypeField.compareDocumentPosition(newRestrictionTypeField)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('No Restriction')).toBeInTheDocument();
			expect(screen.getByText('Greater Than Or Equal')).toBeInTheDocument();
			expect(screen.getAllByText(mosaicId)).not.toHaveLength(0);
		});

		it('renders aggregate complete type and inner transactions in transaction detail', () => {
			// Arrange:
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'AGGREGATE_COMPLETE',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'AGGREGATE_COMPLETE'
				},
				aggregate: {
					innerTransactions: [
						{
							transactionType: 'MULTISIG_ACCOUNT_MODIFICATION',
							signer: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
							detail: {
								transactionType: 'MULTISIG_ACCOUNT_MODIFICATION',
								minApprovalDelta: 2,
								minRemovalDelta: 3
							}
						}
					]
				},
				graphic: {
					transactions: [
						{
							type: 'MULTISIG_ACCOUNT_MODIFICATION',
							sender: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
							minApprovalDelta: 2,
							minRemovalDelta: 3
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const aggregateCompleteFields = screen.getAllByText('transactionType_AGGREGATE_COMPLETE');
			const innerTransactionsLabel = screen.getByText('section_innerTransactions');
			const innerTransactionTypes = screen.getAllByText('transactionType_MULTISIG_ACCOUNT_MODIFICATION');

			expect(aggregateCompleteFields).toHaveLength(2);
			expect(screen.queryByText('section_aggregateInnerTransactions')).not.toBeInTheDocument();
			expect(innerTransactionTypes).not.toHaveLength(0);
			expect(aggregateCompleteFields[1].compareDocumentPosition(innerTransactionsLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(innerTransactionsLabel.compareDocumentPosition(innerTransactionTypes[0])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('field_minApprovalDelta')).toBeInTheDocument();
			expect(screen.getByText('field_minRemovalDelta')).toBeInTheDocument();
			expect(screen.getByText('3')).toBeInTheDocument();
			expect(screen.queryByText('table_field_transactionType')).not.toBeInTheDocument();
			expect(screen.queryByText('table_field_detail')).not.toBeInTheDocument();
		});

		it('renders aggregate bonded type, inner transactions and hash lock details', () => {
			// Arrange:
			const signer = 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY';
			const recipient = 'TC3BWDYZXQXIPNIN5UZHN57ZO6KC6KCK5OQIYJQ';
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'partial',
				type: 'AGGREGATE_BONDED',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'partial',
					signer,
					blockHeight: 0,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					maxFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'AGGREGATE_BONDED'
				},
				aggregate: {
					innerTransactions: [
						{
							transactionType: 'TRANSFER',
							signer,
							detail: {
								transactionType: 'TRANSFER',
								recipient
							}
						}
					]
				},
				hashLock: {
					endHeight: 456,
					ownerAddress: signer,
					status: 'unused',
					mosaics: [
						{
							mosaicId: '72C0212E67A08BCE',
							name: 'XYM',
							amount: 10
						}
					]
				},
				graphic: {
					transactions: [
						{
							type: 'TRANSFER',
							sender: signer,
							recipient
						}
					]
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const aggregateBondedFields = screen.getAllByText('transactionType_AGGREGATE_BONDED');
			const innerTransactionsLabel = screen.getByText('section_innerTransactions');
			const innerTransactionTypes = screen.getAllByText('transactionType_TRANSFER');

			expect(aggregateBondedFields).toHaveLength(2);
			expect(innerTransactionTypes).not.toHaveLength(0);
			expect(aggregateBondedFields[1].compareDocumentPosition(innerTransactionsLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(innerTransactionsLabel.compareDocumentPosition(innerTransactionTypes[0])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByText('section_hashLock')).toBeInTheDocument();
			expect(screen.getByText('field_endHeight')).toBeInTheDocument();
			expect(screen.getByText('456')).toBeInTheDocument();
			expect(screen.getByText('field_ownerAddress')).toBeInTheDocument();
			expect(screen.getAllByText(signer)).not.toHaveLength(0);
			expect(screen.getAllByText('field_status')).not.toHaveLength(0);
			expect(screen.getByText('unused')).toBeInTheDocument();
			expect(screen.getByText('field_mosaics')).toBeInTheDocument();
			expect(screen.queryByText('section_aggregateInnerTransactions')).not.toBeInTheDocument();
		});

		it('renders aggregate cosignature signer with full address display', () => {
			// Arrange:
			const cosignatureSigner = 'TCO3S47LHQXBXQLXH2O3MJVJXNA3KDG73A6D7QQ';
			const cosignatureSignature = 'D'.repeat(128);
			const transactionInfo = {
				hash: 'A'.repeat(64),
				group: 'confirmed',
				type: 'AGGREGATE_COMPLETE',
				version: 1,
				info: {
					transactionHash: 'A'.repeat(64),
					confirm: 'confirmed',
					signer: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
					blockHeight: 123,
					timestamp: '2021-03-16T00:06:26.000Z',
					deadline: '2021-03-16T00:06:26.000Z',
					effectiveFee: 0.0025,
					signature: 'C'.repeat(128),
					version: 1
				},
				detail: {
					transactionType: 'AGGREGATE_COMPLETE'
				},
				aggregate: {
					cosignatures: [
						{
							signer: cosignatureSigner,
							signature: cosignatureSignature
						}
					]
				},
				graphic: {
					transactions: []
				}
			};

			// Act:
			render(<TransactionInfo transactionInfo={transactionInfo} />);

			// Assert:
			const signerLink = screen.getByRole('link', { name: cosignatureSigner });
			expect(screen.getByText('section_aggregateCosignatures')).toBeInTheDocument();
			expect(screen.getByText(cosignatureSignature)).toBeInTheDocument();
			expect(signerLink).toHaveClass('addressFull');
		});
	});
});
