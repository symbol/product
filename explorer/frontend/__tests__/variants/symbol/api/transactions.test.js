import { transactionInfoResponses } from '../../../../__fixtures__/api/symbol/transaction-info';
import { transactionInfoResults } from '../../../../__fixtures__/local/symbol/transaction-info';
import { error404Response, runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import * as utils from '@/app/utils/server';
import { stubTransactions } from '@/app/variants/symbol/api/fixtures';
import { fetchTransactionInfo, fetchTransactionPage } from '@/app/variants/symbol/api/transactions';

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

const transactionURL = 'https://explorer.backend/transaction';
const mappingCases = [
	['transfer', 'maps display amounts, dates, addresses and the decoded transfer message without conversion'],
	['transferZero', 'preserves zero fee and amount and a null message'],
	['transferEmpty', 'preserves empty mosaics and a null message'],
	['transferEncrypted', 'preserves the encrypted message payload'],
	['transferUnconfirmedAlias', 'preserves pending nulls, the unresolved alias and its raw mosaic quantity'],
	['aggregateComplete', 'preserves complete aggregate identity, child order, embedded nulls and cosignatures'],
	['aggregateBonded', 'preserves bonded aggregate type and hash lock information'],
	['aggregatePartial', 'preserves partial parent and child nulls and empty cosignatures without inventing a hash lock'],
	['accountKeyLink', 'maps account key link action, public key and derived address'],
	['accountKeyUnlink', 'maps unlink to the existing graphic enum'],
	['nodeKeyLink', 'preserves node key link type and key information'],
	['vrfKeyLink', 'preserves VRF key link type and key information'],
	['votingKeyLink', 'preserves voting key epochs including zero'],
	['hashLock', 'maps hash lock mosaics without treating the lock as a transfer'],
	['secretLock', 'maps secret lock mosaics and preserves duration and secret'],
	['secretProof', 'preserves secret proof fields without creating a transfer'],
	['accountMetadata', 'preserves account metadata difference bytes rather than a completed value'],
	['mosaicMetadata', 'preserves mosaic metadata target and empty alias names'],
	['namespaceMetadata', 'preserves namespace metadata target and null namespace name'],
	['mosaicDefinition', 'maps the definition mosaic and preserves body flags including false'],
	['mosaicSupplyDecrease', 'maps decrease and preserves the display amount separately from the large raw delta string'],
	['mosaicSupplyIncrease', 'maps increase and preserves the zero raw delta string'],
	['mosaicSupplyRevocation', 'preserves the revocation direction and quantity without changing its type'],
	['multisigModification', 'maps original ordered additions and deletions without inventing a threshold'],
	['addressAlias', 'preserves unlink and the missing namespace name without resolving the alias'],
	['mosaicAlias', 'preserves the mosaic alias instruction'],
	['namespaceSub', 'maps a sub namespace and preserves its parent and null duration'],
	['namespaceRoot', 'maps a root namespace and preserves its null parent and zero duration'],
	['accountAddressRestriction', 'preserves address restriction flags and ordered additions including duplicate aliases'],
	['accountMosaicRestriction', 'preserves original mosaic restriction identifiers'],
	['accountOperationRestriction', 'preserves operation restriction type names and empty deletions'],
	['mosaicAddressRestriction', 'preserves address restriction values as decimal strings'],
	['mosaicGlobalRestriction', 'preserves global restriction comparison types and the zero reference mosaic']
];

describe('variants/symbol/api/transactions', () => {
	describe('fetchTransactionInfo', () => {
		describe('request', () => {
			runApiRequestTests({
				functionToTest: fetchTransactionInfo,
				response: transactionInfoResponses.transfer,
				cases: [{
					description: 'requests the specified hash without query parameters',
					config: { params: transactionInfoResponses.transfer.hash },
					expected: { url: `${transactionURL}/${transactionInfoResponses.transfer.hash}` }
				}]
			});
		});

		describe('result', () => {
			runApiResultTests({
				functionToTest: fetchTransactionInfo,
				cases: [
					...mappingCases.map(([key, description]) => ({
						description,
						config: { params: transactionInfoResponses[key].hash, response: transactionInfoResponses[key] },
						expected: { result: transactionInfoResults[key] }
					})),
					{
						description: 'returns null for the existing not-found page contract',
						config: { error: error404Response },
						expected: { result: null }
					}
				]
			});
		});

		it.each([
			['service unavailable', { response: { data: { status: 503, message: 'Symbol backend data is unavailable' } } }],
			['network failure', new Error('Network Error')],
			['timeout', new Error('timeout of 5000ms exceeded')],
			['invalid JSON', new SyntaxError('Invalid JSON')]
		])('propagates %s', async (_description, error) => {
			// Arrange:
			jest.spyOn(utils, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchTransactionInfo(transactionInfoResponses.transfer.hash)).rejects.toBe(error);
		});

		const unusableResponses = [null, {}, '<html>Unavailable</html>', { ...transactionInfoResponses.transfer, graphic: {} }];

		it.each(unusableResponses)('rejects unusable responses without a fixture or empty fallback (%p)', async response => {
			// Arrange:
			jest.spyOn(utils, 'makeRequest').mockResolvedValue(response);

			// Act + Assert:
			await expect(fetchTransactionInfo(transactionInfoResponses.transfer.hash)).rejects.toThrow(TypeError);
		});

		it('returns the matching detail for different hashes without a fixture fallback', async () => {
			// Arrange:
			const first = transactionInfoResponses.transfer;
			const second = transactionInfoResponses.transferUnconfirmedAlias;
			const spy = jest.spyOn(utils, 'makeRequest')
				.mockResolvedValueOnce(first)
				.mockResolvedValueOnce(second);

			// Act:
			const firstResult = await fetchTransactionInfo(first.hash);
			const secondResult = await fetchTransactionInfo(second.hash);

			// Assert:
			expect(firstResult).toStrictEqual(transactionInfoResults.transfer);
			expect(secondResult).toStrictEqual(transactionInfoResults.transferUnconfirmedAlias);
			expect(spy.mock.calls).toStrictEqual([[`${transactionURL}/${first.hash}`], [`${transactionURL}/${second.hash}`]]);
		});
	});

	describe('fetchTransactionPage', () => {
		it.each([
			[1, stubTransactions],
			[2, []]
		])('preserves the existing list stub on page %s', async (pageNumber, data) => {
			// Arrange:
			const spy = jest.spyOn(utils, 'makeRequest');

			// Act:
			const result = await fetchTransactionPage({ pageNumber });

			// Assert:
			expect(result).toStrictEqual({ data, pageNumber });
			expect(spy).not.toHaveBeenCalled();
		});
	});
});
