import accountUtils from '../../src/utils/accountUtils.js';
import {
	describe, it, jest
} from '@jest/globals';
import { Network, SymbolFacade } from 'symbol-sdk/symbol';

describe('accountUtils', () => {
	describe('deriveKeyPair', () => {
		const generateMockBip44Entropy = identifier => {
			const coinType = Network.MAINNET.identifier === identifier ? 4343 : 1;

			return {
				chainCode: '0x90d3d16b776e542d7b1888e502292fc7b18e91f69be869f33a07f95068ae6e6a',
				coin_type: coinType,
				index: 1,
				masterFingerprint: 0,
				parentFingerprint: 1,
				depth: 2,
				path: `m / bip32:44' / bip32:${coinType}'`,
				privateKey: '0x1f53ba3da42800d092a0c331a20a41acce81d2dd6f710106953ada277c502010',
				publicKey: '0xf2195f2bce44400c76e4a03536e66d9b46840d042e6548e90a5f4d653d7aa133f6'
                    + '2c18ca655eb4366e59088b3815867535e7ce6ca70baf6507c047a4b7637e5cc6'
			};
		};

		const assertDeriveKeyPair = async (identifier, expectedCoinType) => {
			// Arrange:
			const mockRequest = jest.fn();

			global.snap = { request: mockRequest };

			global.snap.request.mockResolvedValue(generateMockBip44Entropy(identifier));

			// Act:
			const keyPair = await accountUtils.deriveKeyPair(identifier, 0);

			// Assert:
			expect(mockRequest).toHaveBeenCalledWith({
				method: 'snap_getBip44Entropy',
				params: {
					coinType: expectedCoinType
				}
			});
			expect(keyPair).toBeInstanceOf(SymbolFacade.KeyPair);
		};

		it('can derive key pair with mainnet network', async () => {
			await assertDeriveKeyPair(104, 4343);
		});

		it('can derive key pair with testnet network', async () => {
			await assertDeriveKeyPair(152, 1);
		});
	});
});
