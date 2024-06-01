import { getBIP44AddressKeyDeriver } from '@metamask/key-tree';
import { PrivateKey } from 'symbol-sdk';
import { Network, SymbolFacade } from 'symbol-sdk/symbol';

const accountUtils = {
	/**
	 * * Derives a key pair from a mnemonic and an address index.
	 * @param {104 | 152} identifier - The network identifier.
	 * @param {number} addressIndex - The address index.
	 * @returns {Promise<SymbolFacade.KeyPair>} - The derived key pair.
	 */
	async deriveKeyPair(identifier, addressIndex) {
		const coinType = Network.MAINNET.identifier === identifier ? 4343 : 1;

		const rootNode = await snap.request({
			method: 'snap_getBip44Entropy',
			params: {
				coinType
			}
		});

		const derivePrivateKey = await getBIP44AddressKeyDeriver(rootNode);
		const key = await derivePrivateKey(addressIndex);

		const privateKey = new PrivateKey(key.privateKeyBytes);
		return new SymbolFacade.KeyPair(privateKey);
	}
};

export default accountUtils;
