import { cosignTransaction, createDeadline } from '../../src/utils';
import { accounts } from '../__fixtures__/local/wallet';
import { utils } from 'symbol-sdk';
import { models } from 'symbol-sdk/nem';

const COSIGNER_PRIVATE_KEY = '40C56A968FB0E551966FD958055EB6634D3AC0372745AFF442460FF20FA13202';
const COSIGNER_PUBLIC_KEY = '76D6417552829B9423925FCCB92144B7F4B2305BDBA2A71490AC73A4B3377AF3';
const MULTISIG_HASH = 'A'.repeat(64);
const NETWORK_TIME = 254452058000;

describe('utils/transaction', () => {
	describe('cosignTransaction', () => {
		it('builds a cosignature whose timestamp and deadline are created from the network time', () => {
			// Arrange:
			const transaction = {
				networkIdentifier: accounts.alice.networkIdentifier,
				hash: MULTISIG_HASH,
				multisigAccountAddress: accounts.carol.address,
				networkTime: NETWORK_TIME
			};
			const { adjusted } = createDeadline(NETWORK_TIME);

			// Act:
			const result = cosignTransaction(transaction, COSIGNER_PRIVATE_KEY);
			// dto.data is the non-verifiable announce body, so deserialize it as a non-verifiable cosignature.
			const cosignature = models.NonVerifiableCosignatureV1.deserialize(utils.hexToUint8(result.dto.data));

			// Assert:
			expect(Number(cosignature.timestamp)).toBe(adjusted.timestamp);
			expect(Number(cosignature.deadline)).toBe(adjusted.deadline);
			expect(result).toStrictEqual({
				hash: expect.stringMatching(/^[0-9A-F]{64}$/),
				signerPublicKey: COSIGNER_PUBLIC_KEY,
				dto: {
					data: expect.stringMatching(/^[0-9A-F]+$/i),
					signature: expect.stringMatching(/^[0-9a-f]{128}$/i)
				}
			});
		});

		it('throws when the hash or multisig account address is missing', () => {
			// Arrange:
			const transaction = { networkIdentifier: 'testnet', networkTime: NETWORK_TIME };

			// Act + Assert:
			expect(() => cosignTransaction(transaction, COSIGNER_PRIVATE_KEY))
				.toThrow('cosignTransaction requires hash and multisigAccountAddress on the transaction object');
		});
	});
});
